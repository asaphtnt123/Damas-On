// ===== CONFIGURAÇÃO DO FIREBASE =====
const firebaseConfig = {
  apiKey: "AIzaSyCNr5JoKsWJVeUYAaVDqmPznZo100v0uvg",
  authDomain: "corretorcerto-76933.firebaseapp.com",
  databaseURL: "https://corretorcerto-76933-default-rtdb.firebaseio.com",
  projectId: "corretorcerto-76933",
  storageBucket: "corretorcerto-76933.firebasestorage.app",
  messagingSenderId: "357149829474",
  appId: "1:357149829474:web:324b2005d82eabbce5e43b"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
// ===== VARIÁVEIS GLOBAIS COMPLETAS =====
// Sistema de áudio
let audioManager = {
    playNotificationSound: function() { console.log('🔊 Som de notificação (fallback)'); },
    playChallengeSound: function() { console.log('🎯 Som de desafio (fallback)'); },
    playGameStartSound: function() { console.log('🎮 Som de início de jogo (fallback)'); },
    playClickSound: function() { console.log('🖱️ Som de clique (fallback)'); },
    playVictorySound: function() { console.log('🎉 Som de vitória (fallback)'); },
    playDefeatSound: function() { console.log('😞 Som de derrota (fallback)'); },
    playSelectionSound: function() { console.log('🔘 Som de seleção (fallback)'); },
    createSound: function() { console.log('🎵 Criando som (fallback)'); }
};

let notificationSound = null;

// Sistema de renderização
let lastRenderTime = 0;
let lastRenderedBoardHash = '';

// Sistema de notificações
let activeNotifications = new Map();

// Sistema de espectadores
let spectatorsModal = null;

// Sistema de mesas
let activeTableListener = null;

// Sistema de voz
// Sistema de voz
let voiceChatSystem = {
    isEnabled: false,
    localStream: null,
    peerConnections: {},
    configuration: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    }
};
let audioElements = {};


// Variáveis principais do jogo
let currentUser = null;
let userData = null;
let gameState = null;
let selectedPiece = null;
let currentGameRef = null;
let gameListener = null;
let tablesListener = null;
let userActiveTable = null;

// Sistema de timer
let moveTimer = null;
let timeLeft = 0;
let currentTimeLimit = 0;

// Sistema de capturas (ADICIONE ESTAS VARIÁVEIS)
let lastCaptureCheckTime = 0;
let lastBoardStateHash = '';
let hasGlobalMandatoryCaptures = false;
let capturingPieces = [];


// ===== ATUALIZAR LAST LOGIN E STATUS ONLINE =====
async function updateUserOnlineStatus() {
    if (!currentUser || !db) return;
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
            isOnline: true
        });
        console.log('Usuário marcado como online:', currentUser.uid);
    } catch (error) {
        console.error('Erro ao atualizar status online:', error);
    }
}
// ===== MARCAR USUÁRIO COMO OFFLINE =====
async function setUserOffline() {
    if (!currentUser || !db) return;
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            isOnline: false,
            lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('Usuário marcado como offline:', currentUser.uid);
    } catch (error) {
        console.error('Erro ao marcar usuário como offline:', error);
    }
}

// ===== LIMPEZA DE USUÁRIOS ORFÃOS (OFFLINE) =====
async function cleanupOrphanedOnlineUsers() {
    if (!db) return;
    
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        const snapshot = await db.collection('users')
            .where('isOnline', '==', true)
            .where('lastActivity', '<', fiveMinutesAgo)
            .get();
        
        const batch = db.batch();
        
        snapshot.forEach(doc => {
            batch.update(doc.ref, {
                isOnline: false,
                lastActivity: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        if (snapshot.size > 0) {
            await batch.commit();
            console.log(`Limpeza: ${snapshot.size} usuários marcados como offline`);
        }
    } catch (error) {
        console.error('Erro na limpeza de usuários online:', error);
    }
}



// ===== SISTEMA DE ACTIVITY PING =====
let activityInterval = null;
let lastActivityTime = Date.now();

function startActivityPing() {
    if (activityInterval) clearInterval(activityInterval);
    
    activityInterval = setInterval(async () => {
        if (currentUser && db) {
            try {
                // Atualizar atividade a cada 30 segundos
                await db.collection('users').doc(currentUser.uid).update({
                    lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
                    isOnline: true
                });
                lastActivityTime = Date.now();
            } catch (error) {
                console.error('Erro no activity ping:', error);
            }
        }
    }, 30 * 1000); // 30 segundos
}

function stopActivityPing() {
    if (activityInterval) {
        clearInterval(activityInterval);
        activityInterval = null;
    }
}

// ===== DETECTAR INATIVIDADE DO USUÁRIO =====
function setupInactivityDetection() {
    let inactivityTimer;
    const inactivityTimeout = 2 * 60 * 1000; // 2 minutos
    
    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            console.log('Usuário inativo por 2 minutos, marcando como away...');
            setUserAway();
        }, inactivityTimeout);
    }
    
    // Eventos que resetam o timer de inatividade
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
    });
    
    resetInactivityTimer();
}

// ===== MARCAR USUÁRIO COMO AUSENTE =====
async function setUserAway() {
    if (!currentUser || !db) return;
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            isOnline: false, // ou você pode criar um status "away" se preferir
            lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('Usuário marcado como ausente por inatividade');
    } catch (error) {
        console.error('Erro ao marcar usuário como ausente:', error);
    }
}
// ===== CHECK USER ACTIVE TABLE (CORRIGIDA) =====
async function checkUserActiveTable(userId = null) {
    const targetUserId = userId || currentUser?.uid;
    
    if (!targetUserId || !db) {
        console.log('❌ checkUserActiveTable: userId ou db não disponível');
        return { hasActiveTable: false };
    }
    
    try {
        console.log('🔍 Verificando mesa ativa para usuário:', targetUserId);
        
        const snapshot = await db.collection('tables')
            .where('players', 'array-contains', { uid: targetUserId })
            .where('status', 'in', ['waiting', 'playing'])
            .limit(1)
            .get();
        
        console.log('📊 Mesas encontradas:', snapshot.size);
        
        if (!snapshot.empty) {
            const tableDoc = snapshot.docs[0];
            const table = tableDoc.data();
            
            console.log('✅ Mesa ativa encontrada:', tableDoc.id, table.status);
            
            return {
                hasActiveTable: true,
                tableId: tableDoc.id, // ← GARANTIR que tableId está sendo retornado
                tableName: table.name,
                tableBet: table.bet || 0,
                tableStatus: table.status,
                tableTimeLimit: table.timeLimit,
                players: table.players || []
            };
        }
        
        console.log('✅ Nenhuma mesa ativa encontrada');
        return { hasActiveTable: false };
        
    } catch (error) {
        console.error('❌ Erro ao verificar mesa ativa:', error);
        return { hasActiveTable: false };
    }
}

// ===== DADOS TEMPORÁRIOS PARA DEMONSTRAÇÃO =====
function showTemporaryData() {
    const usersList = document.getElementById('online-users-list');
    if (!usersList) return;
    
    const users = [
        { 
            id: '1', 
            displayName: 'João Silva', 
            city: 'São Paulo', 
            rating: 1200, 
            coins: 500, 
            isPlaying: true 
        },
        { 
            id: '2', 
            displayName: 'Maria Santos', 
            city: 'Rio de Janeiro', 
            rating: 1350, 
            coins: 800, 
            isPlaying: false 
        },
        { 
            id: '3', 
            displayName: 'Pedro Costa', 
            city: 'Belo Horizonte', 
            rating: 1100, 
            coins: 300, 
            isPlaying: true 
        }
    ];
    
    usersList.innerHTML = users.map(user => `
        <div class="online-user-item" data-user-id="${user.id}">
            <div class="user-avatar">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=3498db&color=fff" 
                     alt="${user.displayName}">
                <div class="online-status"></div>
            </div>
            
            <div class="user-info">
                <div class="user-name">${user.displayName}</div>
                <div class="user-details">
                    <span class="user-rating">
                        <i class="fas fa-star"></i> ${user.rating}
                    </span>
                    <span class="user-coins">
                        <i class="fas fa-coins"></i> ${user.coins}
                    </span>
                    ${user.city ? `<span class="user-city"><i class="fas fa-map-marker-alt"></i> ${user.city}</span>` : ''}
                </div>
            </div>
            
            <div class="user-actions">
                ${user.isPlaying ? `
                    <span class="playing-badge">
                        <i class="fas fa-gamepad"></i> Jogando
                    </span>
                ` : `
                    <button class="btn btn-small btn-primary challenge-btn" 
                            onclick="challengePlayer('${user.id}', '${user.displayName}')">
                        <i class="fas fa-crosshairs"></i> Desafiar
                    </button>
                `}
            </div>
        </div>
    `).join('');
    
    // Atualizar estatísticas
    document.getElementById('total-online-users').textContent = users.length;
    document.getElementById('active-tables').textContent = users.filter(user => user.isPlaying).length;
    document.getElementById('total-coins').textContent = users.reduce((sum, user) => sum + user.coins, 0);
    
    // Atualizar badge
    const badge = document.getElementById('online-users-count');
    if (badge) {
        badge.textContent = users.length;
    }
}

// ===== VERIFICAR SE O BOTÃO EXISTE =====
function checkButtonExists() {
    const btn = document.getElementById('btn-online-users');
    console.log('Botão encontrado:', !!btn);
    if (btn) {
        console.log('Botão HTML:', btn.outerHTML);
    }
}

// Chame esta função para debug
setTimeout(checkButtonExists, 3000);

// Executar limpeza periodicamente
setInterval(cleanupAbandonedTables, 10 * 60 * 1000); // A cada 10 minutos

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM carregado, inicializando aplicação...');
  initializeApp();
});

// ===== FUNÇÃO PARA VERIFICAR ELEMENTOS =====
function checkRequiredElements() {
  const requiredElements = [
    'btn-login', 'btn-register', 'btn-google', 'btn-logout',
    'login-form', 'register-form', 'show-register', 'show-login',
    'btn-register-submit'
  ];
  
  console.log('Verificando elementos necessários:');
  
  requiredElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      console.log(`✓ Elemento #${id} encontrado`);
    } else {
      console.error(`✗ Elemento #${id} NÃO encontrado`);
    }
  });
}
// ===== TESTAR NOTIFICAÇÃO =====
async function testNotification() {
    if (!currentUser || !db) {
        console.log('Usuário não logado ou DB não disponível');
        return;
    }
    
    console.log('=== TESTANDO NOTIFICAÇÃO ===');
    
    try {
        // Enviar uma notificação para si mesmo para teste
        const testData = {
            type: 'challenge',
            fromUserId: currentUser.uid,
            fromUserName: userData.displayName,
            toUserId: currentUser.uid, // Enviar para si mesmo
            message: 'Esta é uma notificação de TESTE!',
            timeLimit: 60,
            betAmount: 0,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending',
            expiresAt: new Date(Date.now() + 5 * 60000),
            read: false
        };
        
        const docRef = await db.collection('notifications').add(testData);
        console.log('Notificação de teste criada com ID:', docRef.id);
        
        showNotification('Notificação de teste enviada!', 'success');
        
    } catch (error) {
        console.error('Erro no teste:', error);
    }
}
function initializeApp() {
    console.log('🚀 Inicializando aplicação Damas Online...');
        // 9. SISTEMA DE VOZ
    initializeVoiceChat();
    
    // 1. DECLARAR TODAS AS VARIÁVEIS PRIMEIRO
    if (typeof notificationSound === 'undefined') {
        var notificationSound = null;
        console.log('🔊 notificationSound declarado');
    }
    
    if (typeof audioManager === 'undefined') {
        var audioManager = {
            playChallengeSound: function() { console.log('🎯 Som de desafio (fallback)'); },
            playNotificationSound: function() { console.log('🔊 Som de notificação (fallback)'); },
            playGameStartSound: function() { console.log('🎮 Som de início de jogo (fallback)'); },
            playClickSound: function() { console.log('🖱️ Som de clique (fallback)'); },
            playVictorySound: function() { console.log('🎉 Som de vitória (fallback)'); },
            playDefeatSound: function() { console.log('😞 Som de derrota (fallback)'); },
            playSelectionSound: function() { console.log('🔘 Som de seleção (fallback)'); },
            createSound: function() { console.log('🎵 Criando som (fallback)'); }
        };
        console.log('🔊 audioManager declarado');
    }
    
    if (typeof activeNotifications === 'undefined') {
        var activeNotifications = new Map();
        console.log('📋 activeNotifications declarado');
    }
    
    // 2. INICIALIZAR VARIÁVEIS GLOBAIS
    initializeGlobalVariables();
    
    // 3. SISTEMAS BÁSICOS
    createSoundControls();
    initializeGameWithSound();
    
    // 4. SISTEMAS PRINCIPAIS
    initializeAuth();
    initializeUI();
    initializeRegisterForm();
    
    // 5. SISTEMAS DE JOGO
    initializeGame();
    initializeNotifications();
    initializeChallengeNotifications();
    setupConnectionMonitoring();
    setupTimerPause();
    initializeTableCheck();
    
    // 6. SISTEMAS SECUNDÁRIOS
    setupWindowCloseHandler();
    initializeOnlineUsersModal();
    
    // 7. OUTROS SISTEMAS
    initializeChat();
    initializeSpectatorsModal();
    initializeProfileModal();
    initializeCoinsModal();
    
    // 8. CONFIGURAÇÕES DE MANUTENÇÃO
    setInterval(cleanupOrphanedOnlineUsers, 10 * 60 * 1000);
    setInterval(cleanupAbandonedTables, 10 * 60 * 1000);
    
    // 9. VERIFICAR DESAFIOS PENDENTES AO INICIAR
    if (currentUser) {
        setTimeout(checkPendingChallenges, 3000);
    }
    
    console.log('✅ Aplicação inicializada com sucesso!');
}

// ===== INICIALIZAR SISTEMA DE VOZ =====
function initializeVoiceChat() {
    console.log('🎤 Inicializando sistema de voz...');
    
    const voiceToggle = document.getElementById('voice-toggle');
    if (!voiceToggle) {
        console.error('Botão de voz não encontrado');
        return;
    }
    
    voiceToggle.addEventListener('click', toggleVoiceChat);
    
    // Verificar suporte a WebRTC
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('WebRTC não suportado neste navegador');
        voiceToggle.style.display = 'none';
        return;
    }
    
    console.log('✅ Sistema de voz inicializado');
}

// ===== TOGGLE VOICE CHAT =====
async function toggleVoiceChat() {
    const voiceToggle = document.getElementById('voice-toggle');
    
    try {
        if (!voiceChatSystem.isEnabled) {
            // Ativar voz
            await startVoiceChat();
            voiceToggle.classList.add('active');
            voiceToggle.innerHTML = '<i class="fas fa-microphone"></i> Voz Ativa';
            voiceChatSystem.isEnabled = true;
            showNotification('Chat de voz ativado', 'success');
        } else {
            // Desativar voz
            stopVoiceChat();
            voiceToggle.classList.remove('active');
            voiceToggle.innerHTML = '<i class="fas fa-microphone-slash"></i> Voz';
            voiceChatSystem.isEnabled = false;
            showNotification('Chat de voz desativado', 'info');
        }
    } catch (error) {
        console.error('Erro ao alternar voz:', error);
        showNotification('Erro ao ativar voz: ' + error.message, 'error');
    }
}

// ===== INICIAR CHAT DE VOZ =====
async function startVoiceChat() {
    try {
        // Obter permissão de microfone
        voiceChatSystem.localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });
        
        console.log('🎤 Microfone acessado com sucesso');
        
        // Iniciar conexões com outros jogadores/espectadores
        if (currentGameRef) {
            await setupVoiceConnections();
        }
        
    } catch (error) {
        console.error('Erro ao acessar microfone:', error);
        if (error.name === 'NotAllowedError') {
            showNotification('Permissão de microfone negada', 'error');
        } else {
            showNotification('Erro ao acessar microfone: ' + error.message, 'error');
        }
        throw error;
    }
}

// ===== PARAR CHAT DE VOZ =====
function stopVoiceChat() {
    // Parar stream local
    if (voiceChatSystem.localStream) {
        voiceChatSystem.localStream.getTracks().forEach(track => track.stop());
        voiceChatSystem.localStream = null;
    }
    
    // Fechar todas as conexões
    Object.values(voiceChatSystem.peerConnections).forEach(pc => {
        pc.close();
    });
    voiceChatSystem.peerConnections = {};
    
    // Remover todos os elementos de áudio
    Object.values(audioElements).forEach(audio => {
        if (audio.parentNode) {
            audio.parentNode.removeChild(audio);
        }
    });
    audioElements = {};
    
    console.log('🔇 Chat de voz parado');
}

// ===== CONFIGURAR CONEXÕES DE VOZ =====
async function setupVoiceConnections() {
    if (!currentGameRef || !voiceChatSystem.localStream) return;
    
    try {
        // Obter lista de jogadores e espectadores
        const tableDoc = await currentGameRef.get();
        const tableData = tableDoc.data();
        
        // Conectar com outros jogadores
        if (tableData.players) {
            tableData.players.forEach(player => {
                if (player.uid !== currentUser.uid) {
                    createPeerConnection(player.uid);
                }
            });
        }
        
        // Conectar com espectadores (opcional)
        if (currentSpectators.length > 0) {
            currentSpectators.forEach(spectator => {
                if (spectator.id !== currentUser.uid) {
                    createPeerConnection(spectator.id);
                }
            });
        }
        
    } catch (error) {
        console.error('Erro ao configurar conexões de voz:', error);
    }
}

// ===== CRIAR CONEXÃO PEER =====
function createPeerConnection(userId) {
    if (voiceChatSystem.peerConnections[userId]) {
        return; // Conexão já existe
    }
    
    const peerConnection = new RTCPeerConnection(voiceChatSystem.configuration);
    voiceChatSystem.peerConnections[userId] = peerConnection;
    
    // Adicionar stream local
    voiceChatSystem.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, voiceChatSystem.localStream);
    });
    
    // Manipular stream remoto
    peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setupAudioElement(userId, remoteStream);
    };
    
    // Manipular ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            sendIceCandidate(userId, event.candidate);
        }
    };
    
    // Criar oferta
    createOffer(userId);
}
// ===== CRIAR OFERTA =====
async function createOffer(userId) {
    try {
        const peerConnection = voiceChatSystem.peerConnections[userId];
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Enviar oferta via Firestore
        await db.collection('voiceOffers').add({
            from: currentUser.uid,
            to: userId,
            offer: offer,
            tableId: currentGameRef.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
    } catch (error) {
        console.error('Erro ao criar oferta:', error);
    }
}

// ===== CONFIGURAR ELEMENTO DE ÁUDIO =====
function setupAudioElement(userId, stream) {
    // Remover elemento existente
    if (audioElements[userId]) {
        audioElements[userId].remove();
    }
    
    // Criar novo elemento de áudio
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.controls = false;
    audio.style.display = 'none';
    audio.srcObject = stream;
    
    document.body.appendChild(audio);
    audioElements[userId] = audio;
    
    console.log('🔊 Áudio configurado para usuário:', userId);
}

// ===== ENVIAR ICE CANDIDATE =====
async function sendIceCandidate(userId, candidate) {
    try {
        await db.collection('voiceCandidates').add({
            from: currentUser.uid,
            to: userId,
            candidate: candidate,
            tableId: currentGameRef.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Erro ao enviar ICE candidate:', error);
    }
}

// ===== INICIALIZAR LISTENERS DE VOZ =====
function initializeVoiceListeners() {
    // Listener para ofertas de voz
    db.collection('voiceOffers')
        .where('to', '==', currentUser.uid)
        .onSnapshot(async (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const offerData = change.doc.data();
                    await handleVoiceOffer(offerData);
                }
            });
        });
    
    // Listener para ICE candidates
    db.collection('voiceCandidates')
        .where('to', '==', currentUser.uid)
        .onSnapshot(async (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const candidateData = change.doc.data();
                    await handleIceCandidate(candidateData);
                }
            });
        });
}

// ===== MANIPULAR OFERTA DE VOZ =====
async function handleVoiceOffer(offerData) {
    try {
        const peerConnection = voiceChatSystem.peerConnections[offerData.from] || 
                              createPeerConnection(offerData.from);
        
        await peerConnection.setRemoteDescription(offerData.offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Enviar resposta
        await db.collection('voiceAnswers').add({
            from: currentUser.uid,
            to: offerData.from,
            answer: answer,
            tableId: currentGameRef.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
    } catch (error) {
        console.error('Erro ao manipular oferta de voz:', error);
    }
}

// ===== MANIPULAR ICE CANDIDATE =====
async function handleIceCandidate(candidateData) {
    try {
        const peerConnection = voiceChatSystem.peerConnections[candidateData.from];
        if (peerConnection) {
            await peerConnection.addIceCandidate(candidateData.candidate);
        }
    } catch (error) {
        console.error('Erro ao manipular ICE candidate:', error);
    }
}
// ===== INICIALIZAR VARIÁVEIS GLOBAIS =====
function initializeGlobalVariables() {
    console.log('📦 Inicializando variáveis globais...');
    
    // Garantir que todas as variáveis globais existam
    if (typeof spectatorsModal === 'undefined') spectatorsModal = null;
    if (typeof activeTableListener === 'undefined') activeTableListener = null;
    if (typeof voiceChatSystem === 'undefined') voiceChatSystem = null;
    if (typeof currentSpectators === 'undefined') currentSpectators = [];
    
    // Variáveis do sistema de notificações - CORRIGIDO
    if (typeof activeNotifications === 'undefined') activeNotifications = new Map();
    if (typeof notificationSound === 'undefined') {
        window.notificationSound = null; // Usar window para garantir acesso global
        console.log('🔊 notificationSound inicializado');
    }
    
    // Variáveis do sistema de áudio
    if (typeof audioManager === 'undefined') {
        window.audioManager = {
            playChallengeSound: function() { console.log('🎯 Som de desafio'); },
            playNotificationSound: function() { console.log('🔊 Som de notificação'); },
            playGameStartSound: function() { console.log('🎮 Som de início de jogo'); },
            playClickSound: function() { console.log('🖱️ Som de clique'); },
            playVictorySound: function() { console.log('🎉 Som de vitória'); },
            playDefeatSound: function() { console.log('😞 Som de derrota'); },
            playSelectionSound: function() { console.log('🔘 Som de seleção'); },
            createSound: function() { console.log('🎵 Criando som'); }
        };
        console.log('🔊 audioManager inicializado');
    }
    
    console.log('✅ Variáveis globais inicializadas');
}

// Adicione ao window para testar no console
// ===== VERIFICAR PERMISSÕES =====
async function checkPermissions() {
    if (!db) return;
    
    try {
        // Tentar ler uma notificação
        const testRead = await db.collection('notifications').limit(1).get();
        console.log('Permissão de LEITURA: ✅ OK');
        
        // Tentar escrever uma notificação
        const testWrite = await db.collection('notifications').add({
            test: true,
            timestamp: new Date()
        });
        await testWrite.delete();
        console.log('Permissão de ESCRITA: ✅ OK');
        
    } catch (error) {
        console.error('Erro de permissão:', error);
        console.error('Código:', error.code);
        
        if (error.code === 'permission-denied') {
            console.error('❌ PERMISSÃO NEGADA - Verifique as regras do Firestore');
            showNotification('Erro de permissão - Contate o administrador', 'error');
        }
    }
}

// Adicione ao window para testar
window.checkPerms = checkPermissions;
// ===== LIMPAR NOTIFICAÇÕES =====
function cleanupNotifications() {
    // Parar todos os timers
    activeNotifications.forEach((notification, id) => {
        clearInterval(notification.timer);
        if (notification.element.parentNode) {
            notification.element.parentNode.removeChild(notification.element);
        }
    });
    
    activeNotifications.clear();
}
// ===== VARIÁVEIS GLOBAIS PARA JOGADORES ONLINE =====
let onlineUsersModal = null;
let onlineUsersListener = null;
let onlineUsers = [];

// ===== INICIALIZAÇÃO DO MODAL DE JOGADORES ONLINE =====
function initializeOnlineUsersModal() {
    console.log('Inicializando modal de jogadores online...');
    
    // Criar modal se não existir
    if (!document.getElementById('online-users-modal')) {
        const modalHTML = `
            <div class="modal online-users-modal" id="online-users-modal">
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>👥 Jogadores Online</h3>
                        <button class="modal-close" id="close-online-users">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="online-users-stats">
                            <div class="stat-card">
                                <i class="fas fa-users"></i>
                                <div>
                                    <span class="stat-number" id="total-online-users">0</span>
                                    <span class="stat-label">Jogadores Online</span>
                                </div>
                            </div>
                            <div class="stat-card">
                                <i class="fas fa-chess-board"></i>
                                <div>
                                    <span class="stat-number" id="active-tables">0</span>
                                    <span class="stat-label">Mesas Ativas</span>
                                </div>
                            </div>
                            <div class="stat-card">
                                <i class="fas fa-coins"></i>
                                <div>
                                    <span class="stat-number" id="total-coins">0</span>
                                    <span class="stat-label">Moedas em Jogo</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="online-users-controls">
                            <div class="search-box">
                                <i class="fas fa-search"></i>
                                <input type="text" id="users-search" placeholder="Buscar jogador...">
                            </div>
                            <select id="users-sort">
                                <option value="rating-desc">Rating (Maior)</option>
                                <option value="rating-asc">Rating (Menor)</option>
                                <option value="coins-desc">Moedas (Maior)</option>
                                <option value="coins-asc">Moedas (Menor)</option>
                                <option value="name-asc">Nome (A-Z)</option>
                                <option value="name-desc">Nome (Z-A)</option>
                            </select>
                        </div>
                        
                        <div class="online-users-list" id="online-users-list">
                            <div class="loading-spinner">
                                <i class="fas fa-spinner fa-spin"></i>
                                <p>Carregando jogadores...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    onlineUsersModal = document.getElementById('online-users-modal');
    
    // Event listeners - CORREÇÃO AQUI
    const onlineUsersBtn = document.getElementById('btn-online-users');
    if (onlineUsersBtn) {
        // Remover event listeners existentes para evitar duplicação
        onlineUsersBtn.replaceWith(onlineUsersBtn.cloneNode(true));
        const newBtn = document.getElementById('btn-online-users');
        
        newBtn.addEventListener('click', function(e) {
            console.log('Botão de jogadores online clicado!');
            e.preventDefault();
            e.stopPropagation();
            openOnlineUsersModal();
        });
    } else {
        console.error('Botão btn-online-users não encontrado!');
    }
    
    const closeBtn = document.getElementById('close-online-users');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeOnlineUsersModal);
    }
    
    // Fechar modal clicando fora
    if (onlineUsersModal) {
        onlineUsersModal.addEventListener('click', (e) => {
            if (e.target === onlineUsersModal) {
                closeOnlineUsersModal();
            }
        });
    }
    
    // Adicionar event listeners para os filtros
    const searchInput = document.getElementById('users-search');
    const sortSelect = document.getElementById('users-sort');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterOnlineUsers);
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', filterOnlineUsers);
    }
    
    console.log('Modal de jogadores online inicializado!');
}

// ===== FUNÇÃO PARA ABRIR MODAL DE JOGADORES ONLINE =====
function openOnlineUsersModal() {
    console.log('Abrindo modal de jogadores online...');
    
    if (!onlineUsersModal) {
        initializeOnlineUsersModal();
        // Dar um pequeno delay para garantir que o modal foi criado
        setTimeout(() => {
            if (onlineUsersModal) {
                onlineUsersModal.classList.add('active');
                document.body.style.overflow = 'hidden';
                loadOnlineUsers();
            }
        }, 100);
        return;
    }
    
    // Carregar jogadores online
    loadOnlineUsers();
    
    onlineUsersModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}


// ===== FUNÇÃO PARA ABRIR MODAL DE JOGADORES ONLINE =====
function openOnlineUsersModal() {
    if (!onlineUsersModal) {
        initializeOnlineUsersModal();
    }
    
    // Carregar jogadores online
    loadOnlineUsers();
    
    onlineUsersModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ===== FUNÇÃO PARA FECHAR MODAL DE JOGADORES ONLINE =====
function closeOnlineUsersModal() {
    if (onlineUsersModal) {
        onlineUsersModal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // Remover listener para economizar recursos
    if (onlineUsersListener) {
        onlineUsersListener();
        onlineUsersListener = null;
    }
}
// ===== CARREGAR JOGADORES ONLINE =====
function loadOnlineUsers() {
    console.log('Carregando jogadores online...');
    
    const usersList = document.getElementById('online-users-list');
    if (usersList) {
        usersList.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Carregando jogadores...</p>
            </div>
        `;
    }
    
    // Remover listener anterior se existir
    if (onlineUsersListener) {
        onlineUsersListener();
    }
    
    // Mostrar dados de exemplo para teste
    showTemporaryData();
    
    // Tentar carregar dados reais se o Firebase estiver disponível
    if (db && currentUser) {
        try {
            onlineUsersListener = db.collection('users')
                .where('isOnline', '==', true)
                .orderBy('lastActivity', 'desc')
                .limit(50)
                .onSnapshot((snapshot) => {
                    onlineUsers = [];
                    snapshot.forEach((doc) => {
                        const user = { id: doc.id, ...doc.data() };
                        // Não incluir o usuário atual na lista
                        if (user.id !== currentUser.uid) {
                            onlineUsers.push(user);
                        }
                    });
                    
                    updateOnlineUsersList();
                    updateOnlineUsersCount();
                    
                }, (error) => {
                    console.error('Erro ao carregar jogadores online:', error);
                    // Manter os dados temporários se der erro
                });
                
        } catch (error) {
            console.error('Erro no listener de jogadores online:', error);
        }
    }
}

// ===== ATUALIZAR LISTA DE JOGADORES ONLINE =====
function updateOnlineUsersList() {
    const usersList = document.getElementById('online-users-list');
    if (!usersList) return;
    
    if (onlineUsers.length === 0) {
        usersList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-slash"></i>
                <h4>Nenhum jogador online</h4>
                <p>Seja o primeiro a jogar!</p>
            </div>
        `;
        return;
    }
    
    // Aplicar filtros e ordenação
    const filteredUsers = filterAndSortUsers(onlineUsers);
    
    usersList.innerHTML = filteredUsers.map(user => `
        <div class="online-user-item" data-user-id="${user.id}">
            <div class="user-avatar">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=3498db&color=fff" 
                     alt="${user.displayName}">
                <div class="online-status"></div>
            </div>
            
            <div class="user-info">
                <div class="user-name">${user.displayName || 'Jogador'}</div>
                <div class="user-details">
                    <span class="user-rating">
                        <i class="fas fa-star"></i> ${user.rating || 1000}
                    </span>
                    <span class="user-coins">
                        <i class="fas fa-coins"></i> ${user.coins || 0}
                    </span>
                    ${user.city ? `<span class="user-city"><i class="fas fa-map-marker-alt"></i> ${user.city}</span>` : ''}
                </div>
            </div>
            
            <div class="user-actions">
                ${user.isPlaying ? `
                    <span class="playing-badge">
                        <i class="fas fa-gamepad"></i> Jogando
                    </span>
                ` : `
                    <button class="btn btn-small btn-primary challenge-btn" 
                            onclick="challengePlayer('${user.id}', '${user.displayName}')">
                        <i class="fas fa-crosshairs"></i> Desafiar
                    </button>
                `}
            </div>
        </div>
    `).join('');
    
    updateOnlineUsersStats();
}

// ===== FILTRAR E ORDENAR JOGADORES =====
function filterAndSortUsers(users) {
    const searchTerm = document.getElementById('users-search')?.value.toLowerCase() || '';
    const sortValue = document.getElementById('users-sort')?.value || 'rating-desc';
    
    let filteredUsers = users;
    
    // Aplicar filtro de busca
    if (searchTerm) {
        filteredUsers = users.filter(user => 
            user.displayName?.toLowerCase().includes(searchTerm) ||
            user.city?.toLowerCase().includes(searchTerm)
        );
    }
    
    // Aplicar ordenação
    filteredUsers.sort((a, b) => {
        switch (sortValue) {
            case 'rating-desc':
                return (b.rating || 0) - (a.rating || 0);
            case 'rating-asc':
                return (a.rating || 0) - (b.rating || 0);
            case 'coins-desc':
                return (b.coins || 0) - (a.coins || 0);
            case 'coins-asc':
                return (a.coins || 0) - (b.coins || 0);
            case 'name-asc':
                return (a.displayName || '').localeCompare(b.displayName || '');
            case 'name-desc':
                return (b.displayName || '').localeCompare(a.displayName || '');
            default:
                return 0;
        }
    });
    
    return filteredUsers;
}

// ===== ATUALIZAR CONTAGEM DE JOGADORES ONLINE =====
function updateOnlineUsersCount() {
    const badge = document.getElementById('online-users-count');
    if (badge) {
        badge.textContent = onlineUsers.length;
    }
}

// ===== ATUALIZAR ESTATÍSTICAS =====
function updateOnlineUsersStats() {
    const totalUsers = onlineUsers.length;
    const activeTables = onlineUsers.filter(user => user.isPlaying).length;
    const totalCoins = onlineUsers.reduce((sum, user) => sum + (user.coins || 0), 0);
    
    document.getElementById('total-online-users').textContent = totalUsers;
    document.getElementById('active-tables').textContent = activeTables;
    document.getElementById('total-coins').textContent = totalCoins.toLocaleString();
}

// ===== DESAFIAR JOGADOR =====
async function challengePlayer(userId, userName) {
    if (!currentUser) {
        showNotification('Você precisa estar logado para desafiar alguém', 'error');
        return;
    }
    
    // Verificar se já tem mesa ativa
    const activeTableInfo = await checkUserActiveTable();
    if (activeTableInfo.hasActiveTable) {
        showNotification('Você já tem uma mesa ativa! Finalize-a antes de desafiar alguém.', 'error');
        return;
    }
    
    try {
        // Verificar se o jogador alvo está online
        const targetUserDoc = await db.collection('users').doc(userId).get();
        if (!targetUserDoc.exists || !targetUserDoc.data().isOnline) {
            showNotification(`${userName} não está mais online`, 'error');
            return;
        }
        
        // Verificar se o jogador alvo já está em um jogo
        if (targetUserDoc.data().isPlaying) {
            showNotification(`${userName} já está em um jogo`, 'error');
            return;
        }
        
        // Mostrar modal de configuração do desafio
        showChallengeModal(userId, userName);
        
    } catch (error) {
        console.error('Erro ao desafiar jogador:', error);
        showNotification('Erro ao desafiar jogador', 'error');
    }
}

// ===== MODAL DE DESAFIO =====
function showChallengeModal(userId, userName) {
    const modalHTML = `
        <div class="modal challenge-modal" id="challenge-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🎯 Desafiar ${userName}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="challenge-info">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=e74c3c&color=fff" 
                             alt="${userName}" class="challenge-avatar">
                        <p>Configure o desafio para ${userName}</p>
                    </div>
                    
                    <div class="form-group">
                        <label>Tempo por jogada:</label>
                        <select id="challenge-time">
                            <option value="30">30 segundos</option>
                            <option value="60" selected>1 minuto</option>
                            <option value="120">2 minutos</option>
                            <option value="300">5 minutos</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Aposta (opcional):</label>
                        <input type="number" id="challenge-bet" min="0" max="${userData?.coins || 0}" 
                               placeholder="0" value="0">
                        <small>Saldo disponível: ${userData?.coins || 0} moedas</small>
                    </div>
                    
                    <div class="challenge-message">
                        <label>Mensagem (opcional):</label>
                        <textarea id="challenge-message" placeholder="Ex: Vamos jogar! Boa sorte!"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-cancel">Cancelar</button>
                    <button id="btn-send-challenge" class="btn btn-primary">Enviar Desafio</button>
                </div>
            </div>
        </div>
    `;
    
    // Remover modal anterior se existir
    const existingModal = document.getElementById('challenge-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('challenge-modal');
    
    // Event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.modal-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    document.getElementById('btn-send-challenge').addEventListener('click', async () => {
        await sendChallenge(userId, userName);
        modal.remove();
    });
    
    modal.classList.add('active');
}
// ===== ENVIAR DESAFIO (COM MAIS LOGS) =====
async function sendChallenge(targetUserId, targetUserName) {
    console.log('=== ENVIANDO DESAFIO ===');
    console.log('👤 De:', currentUser.uid, userData.displayName);
    console.log('🎯 Para:', targetUserId, targetUserName);
    
    const timeLimit = parseInt(document.getElementById('challenge-time').value);
    const betAmount = parseInt(document.getElementById('challenge-bet').value) || 0;
    const message = document.getElementById('challenge-message').value;
    
    console.log('⚙️ Detalhes:', { timeLimit, betAmount, message });
    
    try {
        console.log('📝 Criando notificação no Firestore...');
        
        const notificationData = {
            type: 'challenge',
            fromUserId: currentUser.uid,
            fromUserName: userData.displayName,
            toUserId: targetUserId,
            message: message || `${userData.displayName} te desafiou para uma partida!`,
            timeLimit: timeLimit,
            betAmount: betAmount,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending',
            expiresAt: new Date(Date.now() + 5 * 60000),
            read: false
        };
        
        console.log('💾 Dados da notificação:', notificationData);
        
        const docRef = await db.collection('notifications').add(notificationData);
        
        console.log('✅ Notificação criada com ID:', docRef.id);
        console.log('📤 Desafio enviado com sucesso!');
        
        showNotification(`Desafio enviado para ${targetUserName}! Aguardando resposta...`, 'success');
        
    } catch (error) {
        console.error('❌ Erro ao enviar desafio:', error);
        showNotification('Erro ao enviar desafio: ' + error.message, 'error');
    }
}

// ===== TESTAR LISTENER SIMPLES =====
async function testListenerSimple() {
    console.log('=== TESTE SIMPLES DE LISTENER ===');
    
    if (!currentUser) {
        console.log('❌ Usuário não logado');
        return;
    }
    
    console.log('👤 Usuário:', currentUser.uid);
    console.log('📡 Listener ativo:', !!window.challengeListener);
    
    // Testar se consegue ouvir suas próprias notificações
    const myNotifications = await db.collection('notifications')
        .where('toUserId', '==', currentUser.uid)
        .where('type', '==', 'challenge')
        .get();
    
    console.log('📋 Minhas notificações de desafio:', myNotifications.size);
    
    myNotifications.forEach(doc => {
        const notif = doc.data();
        console.log(`📄 ${doc.id}: ${notif.fromUserName} -> ${notif.status}`);
    });
}

// ===== FILTRAR JOGADORES ONLINE =====
function filterOnlineUsers() {
    if (onlineUsers.length === 0) return;
    updateOnlineUsersList();
}




// ===== PAUSAR TIMER EM MODAIS =====
function setupTimerPause() {
    // Observar abertura de modais
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                const modals = document.querySelectorAll('.modal.active');
                if (modals.length > 0 && moveTimer) {
                    // Modal aberto - pausar timer
                    stopMoveTimer();
                    document.getElementById('game-timer').classList.add('paused');
                } else if (modals.length === 0 && hasGameStarted()) {
                    // Modal fechado - retomar timer se for a vez
                    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
                    if (currentPlayer && currentPlayer.color === gameState.currentTurn) {
                        startMoveTimer();
                        document.getElementById('game-timer').classList.remove('paused');
                    }
                }
            }
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
}


// ===== INITIALIZEAUTH CORRIGIDA (sem duplicação) =====
function initializeAuth() {
    console.log('Inicializando autenticação...');
    
     auth.onAuthStateChanged(async (user) => {
        console.log('Estado de autenticação alterado:', user);
        
        if (user) {
            currentUser = user;
              // Reiniciar listener de notificações
        if (typeof setupChallengeListener === 'function') {
            setupChallengeListener();
        }
            // Marcar usuário como online ao fazer login
            await updateUserOnlineStatus();
            
            // Iniciar sistemas de atividade
            startActivityPing();
            setupInactivityDetection();
            
            loadUserData(user.uid);
            showScreen('main-screen');
            loadTables();
            loadRanking();
            loadFriends();
            
            // Iniciar listener de mesa ativa
            setupActiveTableListener();
              // 🔥 IMPORTANTE: Reiniciar listener de notificações
        console.log('🔄 Reiniciando listener de notificações para usuário:', user.uid);
        setTimeout(() => {
            setupChallengeListener();
            checkActiveListener();
        }, 2000);

        } else {

            // Limpar notificações ao fazer logout
        if (typeof cleanupNotifications === 'function') {
            cleanupNotifications();
        }
 // Parar listener ao fazer logout
        if (window.challengeListener) {
            window.challengeListener();
            window.challengeListener = null;
            console.log('🔌 Listener de notificações parado (logout)');
        }

            // Marcar como offline ao fazer logout
            if (currentUser) {
                await setUserOffline();
            }
            
            currentUser = null;
            userData = null;
            
            // Parar sistemas de atividade
            stopActivityPing();
            
            showScreen('auth-screen');
        }
    });

    // Configurar event listeners dos botões de auth
    const loginBtn = document.getElementById('btn-login');
    const registerBtn = document.getElementById('btn-register');
    const googleBtn = document.getElementById('btn-google');
    const logoutBtn = document.getElementById('btn-logout');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', signIn);
    } else {
        console.error('Botão de login não encontrado');
    }
    
    if (registerBtn) {
        registerBtn.addEventListener('click', showRegisterForm);
    } else {
        console.error('Botão de registro não encontrado');
    }
    
    if (googleBtn) {
        googleBtn.addEventListener('click', signInWithGoogle);
    } else {
        console.error('Botão do Google não encontrado');
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', signOut);
    } else {
        console.error('Botão de logout não encontrado');
    }
    
    // Permitir login com Enter
    if (emailInput) {
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') signIn();
        });
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') signIn();
        });
    }
}


// ===== HANDLERS PARA FECHAMENTO DA PÁGINA =====
function setupWindowCloseHandler() {
    // Evento antes de descarregar a página
    window.addEventListener('beforeunload', async (e) => {
        if (currentUser) {
            // Usar sendBeacon para garantir que a requisição seja enviada
            const data = new Blob([JSON.stringify({
                uid: currentUser.uid,
                isOnline: false,
                timestamp: new Date().toISOString()
            })], {type: 'application/json'});
            
            navigator.sendBeacon('/api/user-offline', data);
            
            // Também tentar atualizar via Firestore
            try {
                await setUserOffline();
            } catch (error) {
                console.error('Erro ao marcar como offline no beforeunload:', error);
            }
        }
    });
    
    // Evento de visibilidade da página
    document.addEventListener('visibilitychange', async () => {
        if (document.hidden && currentUser) {
            // Página ficou invisível (usuário mudou de aba ou minimizou)
            console.log('Página ficou invisível');
            await setUserAway();
        } else if (currentUser) {
            // Página ficou visível novamente
            console.log('Página ficou visível');
            await updateUserOnlineStatus();
            startActivityPing();
        }
    });
}


// ===== VERIFICAR E CORRIGIR STATUS ONLINE =====
async function verifyAndFixOnlineStatus() {
    if (!currentUser || !db) return;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // Se o usuário está marcado como offline mas está logado, corrigir
            if (userData.isOnline === false) {
                console.log('Corrigindo status online do usuário...');
                await updateUserOnlineStatus();
            }
        }
    } catch (error) {
        console.error('Erro ao verificar status online:', error);
    }
}
// ===== SISTEMA DE ACTIVITY PING =====

function startActivityPing() {
    if (activityInterval) clearInterval(activityInterval);
    
    activityInterval = setInterval(() => {
        if (currentUser && db) {
            // Atualizar atividade a cada 2 minutos
            db.collection('users').doc(currentUser.uid).update({
                lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
                isOnline: true
            }).catch(error => {
                console.error('Erro no activity ping:', error);
            });
        }
    }, 2 * 60 * 1000); // 2 minutos
}

function stopActivityPing() {
    if (activityInterval) {
        clearInterval(activityInterval);
        activityInterval = null;
    }
    
    // Marcar como offline quando usuário sai
    if (currentUser && db) {
        db.collection('users').doc(currentUser.uid).update({
            isOnline: false,
            lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(error => {
            console.error('Erro ao marcar como offline:', error);
        });
    }
}


async function signIn() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    showNotification('Por favor, preencha todos os campos', 'error');
    return;
  }
  
  try {
    showLoading(true);
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
 
    
    showNotification('Login realizado com sucesso!', 'success');
  } catch (error) {
    showNotification(getAuthErrorMessage(error), 'error');
  } finally {
    showLoading(false);
  }
}

async function signUp() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    showNotification('Por favor, preencha todos os campos', 'error');
    return;
  }
  
  if (password.length < 6) {
    showNotification('A senha deve ter pelo menos 6 caracteres', 'error');
    return;
  }
  
  // Preencher o formulário de registro e mostrá-lo
  document.getElementById('register-email').value = email;
  document.getElementById('register-password').value = password;
  document.getElementById('register-confirm-password').value = password;
  
  showRegisterForm();
  
  // Rolar para o topo do formulário
  window.scrollTo(0, 0);
}
async function signInWithGoogle() {
    try {
        showLoading(true);
        const provider = new firebase.auth.GoogleAuthProvider();
        const userCredential = await auth.signInWithPopup(provider);
        const user = userCredential.user;
        
   
        
        showNotification('Login com Google realizado!', 'success');
    } catch (error) {
        showNotification('Erro ao fazer login com Google: ' + error.message, 'error');
        showLoading(false);
    }
}
async function signOut() {
    try {
        // Marcar como offline antes de fazer logout
        if (currentUser) {
            await setUserOffline();
        }
        
        await auth.signOut();
        showNotification('Logout realizado com sucesso', 'info');
    } catch (error) {
        showNotification('Erro ao fazer logout', 'error');
    }
}

// ===== DEBUG: VERIFICAR STATUS ONLINE =====
async function checkOnlineStatus() {
    if (!currentUser || !db) return;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('Status online atual:', userData.isOnline);
            console.log('Última atividade:', userData.lastActivity);
        }
    } catch (error) {
        console.error('Erro ao verificar status:', error);
    }
}
// ===== INICIALIZAR CAMPOS DE STATUS PARA USUÁRIOS EXISTENTES =====
async function initializeUserStatusFields() {
    if (!db) return;
    
    try {
        const usersSnapshot = await db.collection('users').get();
        const batch = db.batch();
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const updateData = {};
            
            if (userData.isOnline === undefined) {
                updateData.isOnline = false;
            }
            if (!userData.lastActivity) {
                updateData.lastActivity = firebase.firestore.FieldValue.serverTimestamp();
            }
            if (!userData.lastLogin) {
                updateData.lastLogin = firebase.firestore.FieldValue.serverTimestamp();
            }
            
            if (Object.keys(updateData).length > 0) {
                batch.update(doc.ref, updateData);
            }
        });
        
        if (usersSnapshot.size > 0) {
            await batch.commit();
            console.log('Campos de status inicializados para todos os usuários');
        }
    } catch (error) {
        console.error('Erro ao inicializar campos de status:', error);
    }
}

// Chame esta função uma vez para inicializar os usuários existentes
// initializeUserStatusFields();

function getAuthErrorMessage(error) {
  switch (error.code) {
    case 'auth/invalid-email':
      return 'E-mail inválido';
    case 'auth/user-disabled':
      return 'Usuário desativado';
    case 'auth/user-not-found':
      return 'Usuário não encontrado';
    case 'auth/wrong-password':
      return 'Senha incorreta';
    case 'auth/email-already-in-use':
      return 'E-mail já está em uso';
    case 'auth/weak-password':
      return 'Senha muito fraca';
    default:
      return 'Erro na autenticação: ' + error.message;
  }
}

// ===== FUNÇÃO ESPECÍFICA PARA INICIALIZAR O LINK DE REGISTRO =====
function initializeRegisterLink() {
  console.log('Inicializando link de registro...');
  
  const showRegisterLink = document.getElementById('show-register');
  
  if (showRegisterLink) {
    console.log('Link de registro encontrado:', showRegisterLink);
    
    // Remover event listeners existentes para evitar duplicação
    showRegisterLink.replaceWith(showRegisterLink.cloneNode(true));
    const newRegisterLink = document.getElementById('show-register');
    
    // Adicionar novo event listener
    newRegisterLink.addEventListener('click', function(e) {
      console.log('Clique no link de registro detectado');
      e.preventDefault();
      showRegisterForm();
    });
    
    console.log('Event listener adicionado ao link de registro');
  } else {
    console.error('Link de registro não encontrado. Procurando por #show-register');
    
    // Tentar encontrar o link de outras formas
    const allLinks = document.querySelectorAll('a');
    let registerLink = null;
    
    allLinks.forEach(link => {
      if (link.textContent.includes('Criar uma conta')) {
        registerLink = link;
        console.log('Link encontrado por texto:', link);
      }
    });
    
    if (registerLink) {
      registerLink.addEventListener('click', function(e) {
        console.log('Clique no link de registro (encontrado por texto)');
        e.preventDefault();
        showRegisterForm();
      });
      
      // Adicionar ID para referência futura
      registerLink.id = 'show-register';
    } else {
      console.error('Não foi possível encontrar o link de registro de nenhuma forma');
    }
  }
}

// ===== INICIALIZAÇÃO GERAL =====
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM carregado, inicializando aplicação...');
  initializeApp();
});

// ===== FUNÇÃO PARA ABRIR FORMULÁRIO DE REGISTRO =====
function showRegisterForm() {
  console.log('Função showRegisterForm chamada');
  
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  
  if (loginForm && registerForm) {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    
    // Rolar para o topo para melhor visualização
    window.scrollTo(0, 0);
    
    console.log('Formulário de registro aberto com sucesso');
  } else {
    console.error('Elementos do formulário não encontrados');
    console.log('loginForm:', loginForm);
    console.log('registerForm:', registerForm);
  }
}
// ===== FUNÇÃO PARA VOLTAR AO LOGIN =====  
function showLoginForm() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  
  if (loginForm && registerForm) {
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
  }
}

// ===== ADICIONE ESTE EVENT LISTENER PARA O LINK "Já tenho uma conta" =====
const showLoginLink = document.getElementById('show-login');
if (showLoginLink) {
  showLoginLink.addEventListener('click', function(e) {
    e.preventDefault();
    showLoginForm();
  });
}

// ===== FUNÇÃO DE REGISTRO COMPLETO (PARA O BOTÃO NO FORMULÁRIO DE CADASTRO) =====
async function completeRegistration() {
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;
  const age = parseInt(document.getElementById('register-age').value);
  const country = document.getElementById('register-country').value;
  const city = document.getElementById('register-city').value.trim();
  const acceptedTerms = document.getElementById('register-terms').checked;
  
  // Validações
  if (!name) {
    showNotification('Por favor, informe seu nome completo', 'error');
    return;
  }
  
  if (!validateEmail(email)) {
    showNotification('Por favor, insira um e-mail válido', 'error');
    return;
  }
  
  if (!password) {
    showNotification('Por favor, insira uma senha', 'error');
    return;
  }
  
  if (password.length < 6) {
    showNotification('A senha deve ter pelo menos 6 caracteres', 'error');
    return;
  }
  
  if (password !== confirmPassword) {
    showNotification('As senhas não coincidem', 'error');
    return;
  }
  
  if (!age || age < 10 || age > 120) {
    showNotification('Por favor, informe uma idade válida (entre 10 e 120 anos)', 'error');
    return;
  }
  
  if (!country) {
    showNotification('Por favor, selecione seu país', 'error');
    return;
  }
  
  if (!city) {
    showNotification('Por favor, informe sua cidade', 'error');
    return;
  }
  
  if (!acceptedTerms) {
    showNotification('Você precisa aceitar os termos de uso para continuar', 'error');
    return;
  }
  
  try {
    showLoading(true);
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    
    // Criar documento do usuário no Firestore com todos os dados
    await db.collection('users').doc(userCredential.user.uid).set({
      displayName: name,
      email: email,
      age: age,
      country: country,
      city: city,
      coins: 100,
      wins: 0,
      losses: 0,
      draws: 0,
      rating: 1000,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showNotification('Conta criada com sucesso! Bem-vindo ao Damas Online!', 'success');
    
  } catch (error) {
    showNotification(getAuthErrorMessage(error), 'error');
  } finally {
    showLoading(false);
  }
}

// ===== ADICIONE ESTE EVENT LISTENER PARA O BOTÃO DE REGISTRO NO FORMULÁRIO =====
const registerSubmitBtn = document.getElementById('btn-register-submit');
if (registerSubmitBtn) {
  registerSubmitBtn.addEventListener('click', completeRegistration);
} else {
  // Se o botão não existir, vamos criá-lo dinamicamente
  console.log('Botão de submissão não encontrado, verifique o HTML');
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function tryToDetectCountry() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=pt`);
          const data = await response.json();
          
          if (data && data.countryCode) {
            const countrySelect = document.getElementById('register-country');
            if (countrySelect) {
              const option = Array.from(countrySelect.options).find(opt => opt.value === data.countryCode);
              
              if (option) {
                countrySelect.value = data.countryCode;
                
                if (data.city) {
                  const cityInput = document.getElementById('register-city');
                  if (cityInput && !cityInput.value) {
                    cityInput.value = data.city;
                  }
                }
              }
            }
          }
        } catch (error) {
          console.log('Não foi possível detectar a localização automaticamente');
        }
      },
      (error) => {
        console.log('Usuário negou permissão de localização');
      }
    );
  }
}
// ===== INTERFACE DO USUÁRIO =====
function initializeUI() {

    spectatorsModal = document.getElementById('spectators-modal');
if (!spectatorsModal) {
    spectatorsModal = null; // ou crie o modal
}


  console.log('Inicializando interface do usuário...');
      // Inicializar chat
    initializeChat();
        initializeSpectatorsModal();
            initializeProfileModal();
    initializeCoinsModal();


  // Navegação por abas - verificar se existem
  const navItems = document.querySelectorAll('.nav-item');
  if (navItems.length > 0) {
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const tabName = e.currentTarget.getAttribute('data-tab');
        switchTab(tabName);
      });
    });
  } else {
    console.error('Itens de navegação não encontrados');
  }
  
  // Modal de criação de mesa - verificar se existe
  const createTableBtn = document.getElementById('btn-create-table');
  if (createTableBtn) {
    createTableBtn.addEventListener('click', () => {
      showModal('modal-create-table');
    });
  }
  
  const confirmCreateBtn = document.getElementById('btn-confirm-create');
  if (confirmCreateBtn) {
    confirmCreateBtn.addEventListener('click', createNewTable);
  }
  
  // Botões de fechar modal - verificar se existem
  const modalCloseButtons = document.querySelectorAll('.modal-close, .modal-cancel');
  if (modalCloseButtons.length > 0) {
    modalCloseButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        closeAllModals();
      });
    });
  }
  
  // Configurações - verificar se existe
  const displayNameInput = document.getElementById('display-name');
  if (displayNameInput) {
    displayNameInput.addEventListener('change', updateUserProfile);
  }
  
  // Jogo - verificar se os botões existem
  const leaveGameBtn = document.getElementById('btn-leave-game');
  if (leaveGameBtn) {
        leaveGameBtn.addEventListener('click', confirmLeaveWaitingRoom);
    }
  
  const surrenderBtn = document.getElementById('btn-surrender');
  if (surrenderBtn) {
    surrenderBtn.addEventListener('click', surrenderGame);
  }
  
  const offerDrawBtn = document.getElementById('btn-offer-draw');
  if (offerDrawBtn) {
    offerDrawBtn.addEventListener('click', offerDraw);
  }
  
  // Recuperação de senha - verificar se existe
  const forgotPasswordLink = document.getElementById('forgot-password');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      showPasswordRecovery();
    });
  }
  
  // Conta de teste - verificar se existe
  const testAccountBtn = document.getElementById('btn-test-account');
  if (testAccountBtn) {
    testAccountBtn.addEventListener('click', signInWithTestAccount);
  }
}


// ===== VARIÁVEIS GLOBAIS =====
let profileModal = null;

// ===== INICIALIZAÇÃO DO MODAL DE PERFIL =====
function initializeProfileModal() {
    // Verificar se o botão existe
    const profileBtn = document.getElementById('btn-profile');
    if (!profileBtn) {
        console.log('Botão de perfil não encontrado, tentando novamente...');
        setTimeout(initializeProfileModal, 1000);
        return;
    }
    
    // Criar modal se não existir
    if (!document.getElementById('profile-modal')) {
        const modalHTML = `
            <div class="modal profile-modal" id="profile-modal">
                <div class="modal-content profile-content">
                    <div class="modal-header">
                        <h3>👤 Meu Perfil</h3>
                        <button class="modal-close" id="close-profile">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="profile-header">
                            <div class="profile-avatar">
                                <img id="profile-avatar" src="https://ui-avatars.com/api/?name=U&background=3498db" alt="Avatar">
                                <div class="online-status"></div>
                            </div>
                            <div class="profile-info">
                                <h2 id="profile-name">Carregando...</h2>
                                <p class="profile-email" id="profile-email">carregando...</p>
                                <div class="profile-rating">
                                    <i class="fas fa-star"></i>
                                    <span id="profile-rating">1000</span> pontos
                                </div>
                            </div>
                        </div>
                        
                        <div class="profile-stats">
                            <div class="stat-grid">
                                <div class="stat-card success">
                                    <div class="stat-icon">
                                        <i class="fas fa-trophy"></i>
                                    </div>
                                    <div class="stat-info">
                                        <span class="stat-value" id="stat-wins">0</span>
                                        <span class="stat-label">Vitórias</span>
                                    </div>
                                </div>
                                
                                <div class="stat-card danger">
                                    <div class="stat-icon">
                                        <i class="fas fa-times"></i>
                                    </div>
                                    <div class="stat-info">
                                        <span class="stat-value" id="stat-losses">0</span>
                                        <span class="stat-label">Derrotas</span>
                                    </div>
                                </div>
                                
                                <div class="stat-card warning">
                                    <div class="stat-icon">
                                        <i class="fas fa-handshake"></i>
                                    </div>
                                    <div class="stat-info">
                                        <span class="stat-value" id="stat-draws">0</span>
                                        <span class="stat-label">Empates</span>
                                    </div>
                                </div>
                                
                                <div class="stat-card info">
                                    <div class="stat-icon">
                                        <i class="fas fa-coins"></i>
                                    </div>
                                    <div class="stat-info">
                                        <span class="stat-value" id="stat-coins">0</span>
                                        <span class="stat-label">Moedas</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="profile-details">
                            <h4>📊 Estatísticas Detalhadas</h4>
                            <div class="details-grid">
                                <div class="detail-item">
                                    <span class="detail-label">Total de Partidas</span>
                                    <span class="detail-value" id="total-games">0</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Taxa de Vitória</span>
                                    <span class="detail-value" id="win-rate">0%</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Melhor Sequência</span>
                                    <span class="detail-value" id="best-streak">0</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Desde</span>
                                    <span class="detail-value" id="member-since">-</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="profile-actions">
                            <button class="btn btn-primary" id="btn-edit-profile">
                                <i class="fas fa-edit"></i> Editar Perfil
                            </button>
                            <button class="btn btn-secondary" id="btn-stats-history">
                                <i class="fas fa-history"></i> Histórico
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    profileModal = document.getElementById('profile-modal');
    
    // Remover event listeners existentes
    profileBtn.replaceWith(profileBtn.cloneNode(true));
    const newProfileBtn = document.getElementById('btn-profile');
    
    // Adicionar event listeners
    newProfileBtn.addEventListener('click', openProfileModal);
    
    const closeBtn = document.getElementById('close-profile');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeProfileModal);
    }
    
    // Fechar modal clicando fora
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                closeProfileModal();
            }
        });
    }
    
    // Botões de ação
    const editBtn = document.getElementById('btn-edit-profile');
    const historyBtn = document.getElementById('btn-stats-history');
    
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            showNotification('Funcionalidade em desenvolvimento', 'info');
        });
    }
    
    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
            showNotification('Histórico em desenvolvimento', 'info');
        });
    }
    
    console.log('Modal de perfil inicializado com sucesso!');
}

// ===== FUNÇÃO PARA ABRIR MODAL DE PERFIL =====
function openProfileModal() {
    if (!profileModal) {
        initializeProfileModal();
        return;
    }
    
    // Atualizar dados antes de abrir
    updateProfileModal();
    
    profileModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ===== FUNÇÃO PARA FECHAR MODAL DE PERFIL =====
function closeProfileModal() {
    if (profileModal) {
        profileModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ===== FUNÇÃO PARA ATUALIZAR MODAL DE PERFIL =====
function updateProfileModal() {
    if (!profileModal || !userData) return;
    
    // Atualizar informações básicas
    document.getElementById('profile-name').textContent = userData.displayName || 'Usuário';
    document.getElementById('profile-email').textContent = currentUser.email || 'Email não disponível';
    document.getElementById('profile-rating').textContent = userData.rating || 1000;
    
    // Atualizar avatar
    const avatarImg = document.getElementById('profile-avatar');
    if (avatarImg && userData.displayName) {
        const initials = userData.displayName.charAt(0).toUpperCase();
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.displayName)}&background=3498db&color=fff`;
    }
    
    // Atualizar estatísticas
    document.getElementById('stat-wins').textContent = userData.wins || 0;
    document.getElementById('stat-losses').textContent = userData.losses || 0;
    document.getElementById('stat-draws').textContent = userData.draws || 0;
    document.getElementById('stat-coins').textContent = userData.coins || 0;
    
    // Calcular estatísticas adicionais
    const totalGames = (userData.wins || 0) + (userData.losses || 0) + (userData.draws || 0);
    const winRate = totalGames > 0 ? Math.round(((userData.wins || 0) / totalGames) * 100) : 0;
    const bestStreak = userData.bestWinStreak || 0;
    
    document.getElementById('total-games').textContent = totalGames;
    document.getElementById('win-rate').textContent = `${winRate}%`;
    document.getElementById('best-streak').textContent = bestStreak;
    
    // Data de criação
    if (userData.createdAt) {
        const createdDate = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
        document.getElementById('member-since').textContent = createdDate.toLocaleDateString('pt-BR');
    } else {
        document.getElementById('member-since').textContent = 'Não disponível';
    }

    // Adicionar botão de compra de moedas se não existir
    if (!document.getElementById('btn-add-coins')) {
        const addCoinsBtn = `
            <button class="btn btn-success" id="btn-add-coins">
                <i class="fas fa-plus"></i> Adicionar Moedas
            </button>
        `;
        const actionsDiv = document.querySelector('.profile-actions');
        if (actionsDiv) {
            actionsDiv.insertAdjacentHTML('beforeend', addCoinsBtn);
            
            // Adicionar event listener
            const addCoinsBtnElement = document.getElementById('btn-add-coins');
            if (addCoinsBtnElement) {
                addCoinsBtnElement.addEventListener('click', openCoinsModal);
            }
        }
    }
}

// ===== VARIÁVEIS GLOBAIS =====
let coinsModal = null;
let userBalance = 1000; // Saldo inicial do usuário
let currentBet = 0;
let HOUSE_FEE_PERCENTAGE = 15; // Taxa da casa de 15%
let currentPot = 0;

// ===== PACOTES DE MOEDAS (SEM BÔNUS) =====
const COINS_PACKAGES = [
    { id: 1, coins: 10, price: 10.00, popular: false },
    { id: 2, coins: 25, price: 25.00, popular: false },
    { id: 3, coins: 50, price: 50.00, popular: true }, // Mais popular
    { id: 4, coins: 100, price: 100.00, popular: false },
    { id: 5, coins: 250, price: 250.00, popular: false },
    { id: 6, coins: 500, price: 500.00, popular: false }
];

// ===== INICIALIZAÇÃO DO MODAL DE MOEDAS =====
function initializeCoinsModal() {
    // Verificar se já existe
    if (!document.getElementById('coins-modal')) {
        const modalHTML = `
            <div class="modal coins-modal" id="coins-modal">
                <div class="modal-content coins-content">
                    <div class="modal-header">
                        <h3>💰 Adicionar Moedas</h3>
                        <button class="modal-close" id="close-coins">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="coins-balance">
                            <div class="balance-info">
                                <i class="fas fa-coins"></i>
                                <span>Saldo atual: <strong id="current-coins-balance">${userBalance}</strong> moedas</span>
                            </div>
                        </div>
                        
                        <div class="packages-header">
                            <h4>Escolha um pacote</h4>
                            <p>Adicione moedas para apostar em partidas emocionantes!</p>
                        </div>
                        
                        <div class="coins-packages">
                            ${COINS_PACKAGES.map(pkg => `
                                <div class="coin-package ${pkg.popular ? 'popular' : ''}" data-package-id="${pkg.id}">
                                    ${pkg.popular ? '<div class="popular-badge">MAIS POPULAR</div>' : ''}
                                    <div class="package-content">
                                        <div class="coins-amount">
                                            <span class="coins-number">${pkg.coins}</span>
                                            <span class="coins-label">moedas</span>
                                        </div>
                                        <div class="package-price">
                                            R$ ${pkg.price.toFixed(2).replace('.', ',')}
                                        </div>
                                        <div class="package-value">
                                            R$ ${(pkg.price / pkg.coins).toFixed(4).replace('.', ',')} por moeda
                                        </div>
                                        <button class="btn btn-primary btn-buy">
                                            Comprar Agora
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div class="payment-methods">
                            <h4>Métodos de Pagamento</h4>
                            <div class="methods-grid">
                                <div class="payment-method">
                                    <i class="fab fa-cc-visa"></i>
                                    <span>Cartão de Crédito</span>
                                </div>
                                <div class="payment-method">
                                    <i class="fab fa-pix"></i>
                                    <span>PIX</span>
                                </div>
                                <div class="payment-method">
                                    <i class="fab fa-paypal"></i>
                                    <span>PayPal</span>
                                </div>
                                <div class="payment-method">
                                    <i class="fas fa-barcode"></i>
                                    <span>Boleto</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="security-info">
                            <div class="security-item">
                                <i class="fas fa-lock"></i>
                                <span>Pagamento seguro</span>
                            </div>
                            <div class="security-item">
                                <i class="fas fa-shield-alt"></i>
                                <span>Dados protegidos</span>
                            </div>
                            <div class="security-item">
                                <i class="fas fa-clock"></i>
                                <span>Entrega instantânea</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    coinsModal = document.getElementById('coins-modal');
    
    // Event listeners
    const closeBtn = document.getElementById('close-coins');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCoinsModal);
    }
    
    // Fechar modal clicando fora
    if (coinsModal) {
        coinsModal.addEventListener('click', (e) => {
            if (e.target === coinsModal) {
                closeCoinsModal();
            }
        });
    }
    
    // Event listeners para botões de compra
    const buyButtons = document.querySelectorAll('.btn-buy');
    buyButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const packageElement = e.target.closest('.coin-package');
            const packageId = packageElement.dataset.packageId;
            const selectedPackage = COINS_PACKAGES.find(p => p.id === parseInt(packageId));
            
            if (selectedPackage) {
                handleCoinPurchase(selectedPackage);
            }
        });
    });
}
// ===== FUNÇÃO PARA ABRIR MODAL DE MOEDAS =====
function openCoinsModal() {
    if (!coinsModal) {
        initializeCoinsModal();
    }
    
    // Atualizar saldo antes de abrir
    updateCoinsModal();
    
    coinsModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}



// ===== FUNÇÃO PARA ATUALIZAR MODAL DE MOEDAS =====
function updateCoinsModal() {
    if (!coinsModal || !userData) return;
    
    // Atualizar saldo atual
    const balanceElement = document.getElementById('current-coins-balance');
    if (balanceElement) {
        balanceElement.textContent = userData.coins || 0;
    }
}

// ===== FUNÇÃO SHOWSCREEN (CORRIGIDA) =====
function showScreen(screenId) {
  console.log('Mostrando tela:', screenId);
  
  // Primeiro, ocultar todas as telas
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
    screen.style.display = 'none'; // Garantir que está oculto
  });
  
  // Mostrar a tela solicitada
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
    screen.style.display = 'block'; // Garantir que está visível
    console.log('Tela', screenId, 'mostrada com sucesso');
  } else {
    console.error('Tela não encontrada:', screenId);
    
    // Fallback: tentar encontrar a tela de jogo por classe ou outro seletor
    const gameScreen = document.querySelector('.game-screen') || document.querySelector('[data-screen="game"]');
    if (gameScreen) {
      gameScreen.classList.add('active');
      gameScreen.style.display = 'block';
      console.log('Fallback: Tela de jogo encontrada por seletor alternativo');
    }
  }
}


function switchTab(tabName) {
  console.log('Mudando para aba:', tabName);
  
  // Atualizar navegação
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const activeNavItem = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (activeNavItem) {
    activeNavItem.classList.add('active');
  }
  
  // Mostrar conteúdo da aba
  document.querySelectorAll('.tab-pane').forEach(tab => {
    tab.classList.remove('active');
  });
  
  const activeTab = document.getElementById(tabName);
  if (activeTab) {
    activeTab.classList.add('active');
  }
}

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('active');
  });
}

function showLoading(show) {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    if (show) {
      loadingEl.classList.add('active');
    } else {
      loadingEl.classList.remove('active');
    }
  }
}
// ===== SHOW NOTIFICATION (CORRIGIDA) =====
function showNotification(message, type = 'info', duration = 5000) {
    console.log(`📢 Notificação [${type}]: ${message}`);
    
    // ✅ VERIFICAÇÃO SEGURA do audioManager
    if (audioManager && typeof audioManager.playNotificationSound === 'function') {
        try {
            audioManager.playNotificationSound();
        } catch (error) {
            console.warn('Erro ao reproduzir som de notificação:', error);
        }
    } else {
        console.warn('audioManager não disponível para tocar som de notificação');
    }
    
    // Remover notificações anteriores
    removeExistingNotifications();
    
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Ícone baseado no tipo
    let icon = 'info-circle';
    if (type === 'error') icon = 'exclamation-triangle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'warning') icon = 'exclamation-circle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    // Adicionar ao documento
    document.body.appendChild(notification);
    
    // Animação de entrada
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Remover após o tempo especificado
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 500);
    }, duration);
}
// ===== REMOVER NOTIFICAÇÕES EXISTENTES (CORRIGIDA) =====
function removeExistingNotifications() {
    try {
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    } catch (error) {
        console.warn('Erro ao remover notificações:', error);
    }
}

// ===== GERENCIAMENTO DE USUÁRIO =====
async function loadUserData(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            userData = { id: uid, ...userData, ...userDoc.data() };
            updateUIWithUserData();
            
            // Atualizar modal de perfil se estiver aberto
            if (profileModal && profileModal.classList.contains('active')) {
                updateProfileModal();
            }
        } else {
            console.error('Documento do usuário não encontrado');
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}

function updateUI() {
    // Atualizar saldo exibido
    const balanceElement = document.getElementById('current-coins-balance');
    if (balanceElement) {
        balanceElement.textContent = userBalance;
    }
    
    // Atualizar elemento de aposta atual (se existir)
    const betElement = document.getElementById('current-bet');
    if (betElement) {
        betElement.textContent = currentBet;
    }
    
    // Atualizar elemento de pote atual (se existir)
    const potElement = document.getElementById('current-pot');
    if (potElement) {
        potElement.textContent = currentPot;
    }
}

/**
 * Simula a compra de moedas (em um sistema real, isso se conectaria a um gateway de pagamento)
 * @param {Object} package - Pacote de moedas selecionado
 */
function handleCoinPurchase(package) {
    // Simular processamento de pagamento
    console.log(`Processando compra do pacote ${package.id}...`);
    
    // Adicionar moedas ao saldo do usuário (sem bônus)
    userBalance += package.coins;
    
    // Atualizar UI
    updateUI();
    
    // Fechar modal
    closeCoinsModal();
    
    // Mostrar confirmação
    alert(`Compra realizada com sucesso! ${package.coins} moedas adicionadas à sua conta.`);
}

/**
 * Fecha o modal de compra de moedas
 */
function closeCoinsModal() {
    if (coinsModal) {
        coinsModal.style.display = 'none';
    }
}

/**
 * Abre o modal de compra de moedas
 */




function updateUIWithUserData() {
  if (userData && userData.displayName) {
    const displayNameInput = document.getElementById('display-name');
    if (displayNameInput) {
      displayNameInput.value = userData.displayName;
    }
  }
}

async function updateUserProfile() {
  const displayName = document.getElementById('display-name').value;
  
  if (!displayName) {
    showNotification('Nome de exibição não pode estar vazio', 'error');
    return;
  }
  
  try {
    await db.collection('users').doc(currentUser.uid).update({
      displayName: displayName
    });
    
    userData.displayName = displayName;
    showNotification('Perfil atualizado com sucesso', 'success');
  } catch (error) {
    showNotification('Erro ao atualizar perfil', 'error');
  }
}


// ===== FUNÇÃO LOAD TABLES (ATUALIZADA) =====
function loadTables() {
    // Remover listener anterior se existir
    if (tablesListener) tablesListener();
    
    tablesListener = db.collection('tables')
        .where('status', 'in', ['waiting', 'playing', 'finished'])
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            const tablesContainer = document.getElementById('tables-container');
            if (tablesContainer) {
                tablesContainer.innerHTML = '';
                
                // Separar mesas por status
                const waitingTables = [];
                const playingTables = [];
                const finishedTables = [];
                
                snapshot.forEach((doc) => {
                    const table = { id: doc.id, ...doc.data() };
                    
                    if (table.status === 'waiting') waitingTables.push(table);
                    else if (table.status === 'playing') playingTables.push(table);
                    else if (table.status === 'finished') finishedTables.push(table);
                });
                
                // Adicionar seção de mesas aguardando
                if (waitingTables.length > 0) {
                    const sectionHeader = document.createElement('div');
                    sectionHeader.className = 'tables-section-header';
                    sectionHeader.innerHTML = '<h3>Mesas Disponíveis</h3>';
                    tablesContainer.appendChild(sectionHeader);
                    
                    waitingTables.forEach(table => renderTable(table, tablesContainer));
                }
                
                // Adicionar seção de mesas em jogo
                if (playingTables.length > 0) {
                    const sectionHeader = document.createElement('div');
                    sectionHeader.className = 'tables-section-header';
                    sectionHeader.innerHTML = '<h3>Jogos em Andamento</h3>';
                    tablesContainer.appendChild(sectionHeader);
                    
                    playingTables.forEach(table => renderTable(table, tablesContainer));
                }
                
                // Adicionar seção de mesas finalizadas
                if (finishedTables.length > 0) {
                    const sectionHeader = document.createElement('div');
                    sectionHeader.className = 'tables-section-header';
                    sectionHeader.innerHTML = '<h3>Jogos Finalizados</h3>';
                    tablesContainer.appendChild(sectionHeader);
                    
                    finishedTables.forEach(table => renderTable(table, tablesContainer));
                }
                
                // Mensagem se não houver mesas
                if (waitingTables.length === 0 && playingTables.length === 0 && finishedTables.length === 0) {
                    tablesContainer.innerHTML = '<p class="text-center">Nenhuma mesa disponível</p>';
                }
            }
        }, (error) => {
            console.error('Erro ao carregar mesas:', error);
        });
}



// ===== CONVERSOR DE TABULEIRO PARA FORMATO FIRESTORE-COMPATÍVEL =====
function convertBoardToFirestoreFormat(board) {
  // Converter o array bidimensional em um objeto onde cada linha é um campo
  const firestoreBoard = {};
  
  for (let row = 0; row < board.length; row++) {
    const rowKey = `row_${row}`;
    firestoreBoard[rowKey] = {};
    
    for (let col = 0; col < board[row].length; col++) {
      const cellKey = `col_${col}`;
      const cellValue = board[row][col];
      
      // Se a célula tem uma peça, converter para formato simples
      if (cellValue) {
        firestoreBoard[rowKey][cellKey] = {
          color: cellValue.color,
          king: cellValue.king || false
        };
      } else {
        firestoreBoard[rowKey][cellKey] = null;
      }
    }
  }
  
  return firestoreBoard;
}

// ===== CONVERSOR DE VOLTA PARA ARRAY BIDIMENSIONAL =====
function convertFirestoreFormatToBoard(firestoreBoard) {
  const board = Array(8).fill().map(() => Array(8).fill(null));
  
  for (let row = 0; row < 8; row++) {
    const rowKey = `row_${row}`;
    
    if (firestoreBoard[rowKey]) {
      for (let col = 0; col < 8; col++) {
        const cellKey = `col_${col}`;
        
        if (firestoreBoard[rowKey][cellKey]) {
          board[row][col] = {
            color: firestoreBoard[rowKey][cellKey].color,
            king: firestoreBoard[rowKey][cellKey].king || false
          };
        } else {
          board[row][col] = null;
        }
      }
    }
  }
  
  return board;
}

// ===== INICIALIZAÇÃO DO TABULEIRO (CORREÇÃO DEFINITIVA) =====
function initializeBrazilianCheckersBoard() {
  const board = Array(8).fill().map(() => Array(8).fill(null));
  
  console.log('Inicializando tabuleiro brasileiro...');
  
  // PEÇAS PRETAS (jogador 1) - TOPO (linhas 0,1,2)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      // Colocar peças apenas nas casas escuras (row + col) % 2 !== 0
      if ((row + col) % 2 !== 0) {
        board[row][col] = { color: 'black', king: false };
        console.log(`Peça preta colocada em: ${row},${col}`);
      }
    }
  }
  
  // PEÇAS VERMELHAS (jogador 2) - BASE (linhas 5,6,7) 
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      // Colocar peças apenas nas casas escuras (row + col) % 2 !== 0
      if ((row + col) % 2 !== 0) {
        board[row][col] = { color: 'red', king: false };
        console.log(`Peça vermelha colocada em: ${row},${col}`);
      }
    }
  }
  
  // DEBUG: Mostrar tabuleiro completo
  console.log('=== TABULEIRO INICIALIZADO ===');
  for (let row = 0; row < 8; row++) {
    let rowStr = `${row}: `;
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        rowStr += piece.color === 'black' ? 'B ' : 'R ';
      } else {
        rowStr += (row + col) % 2 !== 0 ? '_ ' : 'X ';
      }
    }
    console.log(rowStr);
  }
  
  return board;
}


// ===== CREATE NEW TABLE (CORRIGIDA) =====
async function createNewTable() {
    console.log('🎯 Criando nova mesa...');
    
    // Verificar se já tem mesa ativa
    const activeTableInfo = await checkUserActiveTable();
    if (activeTableInfo.hasActiveTable) {
        showNotification('Você já tem uma mesa ativa! Finalize-a antes de criar outra.', 'error');
        
        if (activeTableInfo.tableId) {
            setTimeout(() => {
                joinTable(activeTableInfo.tableId);
            }, 2000);
        }
        
        return;
    }
    
    const tableName = document.getElementById('table-name').value || `Mesa de ${userData.displayName}`;
    const timeLimit = parseInt(document.getElementById('table-time').value);
    const bet = parseInt(document.getElementById('table-bet').value) || 0;
    
    // 🔥 CORREÇÃO: Verificar se o usuário tem saldo suficiente ANTES de criar a mesa
    if (bet > 0) {
        // Carregar dados atualizados do usuário para verificar saldo
        await loadUserData(currentUser.uid);
        
        if (!userData || userData.coins < bet) {
            showNotification(`Você não tem moedas suficientes para esta aposta! Saldo: ${userData?.coins || 0} moedas`, 'error');
            return;
        }
    }
    
    try {
        const boardData = convertBoardToFirestoreFormat(initializeBrazilianCheckersBoard());
        
        const tableRef = await db.collection('tables').add({
            name: tableName,
            timeLimit: timeLimit,
            bet: bet,
            status: 'waiting',
            players: [{
                uid: currentUser.uid,
                displayName: userData.displayName,
                rating: userData.rating,
                color: 'black'
            }],
            createdBy: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            currentTurn: 'black',
            board: boardData,
            waitingForOpponent: true,
            platformFee: calculatePlatformFee(bet)
        });
        
        // ✅ SALVAR tableId CORRETAMENTE
        userActiveTable = tableRef.id;
        console.log('✅ Mesa criada com ID:', userActiveTable);
        
        // 🔥 CORREÇÃO: Deduzir aposta apenas se for maior que 0
        if (bet > 0) {
            await db.collection('users').doc(currentUser.uid).update({
                coins: firebase.firestore.FieldValue.increment(-bet)
            });
            // Atualizar dados locais do usuário
            userData.coins -= bet;
        }
        
        closeAllModals();
        showNotification('Mesa criada com sucesso! Aguardando oponente...', 'success');
        
        // 🔥 ATUALIZAR LISTENER E LISTA DE USUÁRIOS ONLINE
        if (typeof setupActiveTableListener === 'function') {
            setupActiveTableListener();
        }
        
        // Atualizar lista de usuários online após um breve delay
        setTimeout(() => {
            if (typeof refreshOnlineUsersList === 'function') {
                refreshOnlineUsersList();
            }
        }, 1000);
        
        setupGameListener(tableRef.id);
        showScreen('game-screen');
        setupGameListener(tableRef.id); // ← Use o ID da mesa criada

        
    } catch (error) {
        console.error('❌ Erro ao criar mesa:', error);
        showNotification('Erro ao criar mesa: ' + error.message, 'error');
    }
}
// ===== JOIN TABLE (CORRIGIDA) =====
async function joinTable(tableId) {
const originalJoinTable = joinTable;
joinTable = async function(tableId) {
    audioManager.playGameStartSound();
    return originalJoinTable.call(this, tableId);
};

    console.log('🎯 Entrando na mesa:', tableId);
    
    // ✅ VERIFICAÇÃO CRÍTICA: garantir que tableId não está vazio
    if (!tableId || typeof tableId !== 'string' || tableId.trim() === '') {
        console.error('❌ TableId inválido:', tableId);
        showNotification('Erro: ID da mesa inválido', 'error');
        return;
    }
    
    try {
        userActiveTable = tableId;
        
        const tableRef = db.collection('tables').doc(tableId);
        const tableDoc = await tableRef.get();
        
        if (!tableDoc.exists) {
            console.error('❌ Mesa não encontrada:', tableId);
            showNotification('Mesa não encontrada', 'error');
            userActiveTable = null;
            return;
        }
        
        const table = tableDoc.data();

 // ✅ VERIFICAÇÃO: Garantir que table existe e tem status
        if (!table) {
            console.error('❌ Dados da mesa não encontrados');
            showNotification('Erro ao carregar mesa', 'error');
            userActiveTable = null;
            return;
        }
        
        // ✅ VALOR PADRÃO para status se não existir
        if (!table.status) {
            console.warn('⚠️ Status da mesa não definido, usando padrão "waiting"');
            table.status = 'waiting';
        }

        // 🔥 VERIFICAR SE É UMA MESA DE DESAFIO
        if (table.isChallenge && table.status === 'waiting') {
            console.log('✅ Entrando em mesa de desafio');
            
            // Atualizar mesa para status playing
            await tableRef.update({
                status: 'playing',
                waitingForOpponent: false,
                lastMoveTime: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Se usuário já está na mesa, apenas entrar
        if (table.players.some(p => p.uid === currentUser.uid)) {
            console.log('✅ Usuário já está na mesa, apenas entrando...');
            setupGameListener(tableId);
            showScreen('game-screen');
            
            if (table.players.length === 1) {
                showNotification('Aguardando adversário...', 'info');
            } else {
                showNotification('Jogo em andamento', 'info');
            }
            
            // 🔥 ATUALIZAR LISTENER
            if (typeof setupActiveTableListener === 'function') {
                setupActiveTableListener();
            }
            return;
        }
        
        // Verificar se mesa está cheia
        if (table.players.length >= 2) {
            console.log('❌ Mesa cheia:', tableId);
            showNotification('Esta mesa já está cheia', 'error');
            userActiveTable = null;
            return;
        }
        
        
        // 🔥 CORREÇÃO: Verificar saldo ANTES de entrar na mesa com aposta
        if (table.bet > 0) {
            // Carregar dados atualizados do usuário
            await loadUserData(currentUser.uid);
            
            if (!userData || userData.coins < table.bet) {
                showNotification(`Você não tem moedas suficientes para entrar nesta mesa! Saldo: ${userData?.coins || 0} moedas`, 'error');
                userActiveTable = null;
                return;
            }
        }
        
        // Adicionar jogador à mesa
        await tableRef.update({
            players: firebase.firestore.FieldValue.arrayUnion({
                uid: currentUser.uid,
                displayName: userData.displayName,
                rating: userData.rating,
                color: 'red'
            }),
            status: 'playing',
            waitingForOpponent: false,
            lastMoveTime: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Jogador adicionado à mesa');
        
        // Deduzir aposta se houver
        if (table.bet > 0) {
            await db.collection('users').doc(currentUser.uid).update({
                coins: firebase.firestore.FieldValue.increment(-table.bet)
            });
            userData.coins -= table.bet;
        }
        
        // Entrar no jogo
        setupGameListener(tableId);
        showScreen('game-screen');
        showNotification('Jogo iniciado! As peças pretas começam.', 'success');
        
        // 🔥 ATUALIZAR LISTENER E LISTA DE USUÁRIOS ONLINE
        if (typeof setupActiveTableListener === 'function') {
            setupActiveTableListener();
        }
        
        // Atualizar lista de usuários online
        setTimeout(() => {
            if (typeof refreshOnlineUsersList === 'function') {
                refreshOnlineUsersList();
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Erro ao entrar na mesa:', error);
        userActiveTable = null;
        showNotification('Erro ao entrar na mesa: ' + error.message, 'error');
    }
}
// ===== LIMPEZA DE MESAS ABANDONADAS =====
async function cleanupAbandonedTables() {
    if (!currentUser) return;
    
    try {
        // Procurar mesas antigas do usuário
        const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
        
        const snapshot = await db.collection('tables')
            .where('createdBy', '==', currentUser.uid)
            .where('status', 'in', ['waiting'])
            .where('createdAt', '<', twentyMinutesAgo)
            .get();
        
        const batch = db.batch();
        
        snapshot.forEach(doc => {
            // Devolver apostas se houver
            const table = doc.data();
            if (table.bet > 0) {
                batch.update(db.collection('users').doc(currentUser.uid), {
                    coins: firebase.firestore.FieldValue.increment(table.bet)
                });
            }
            
            // Excluir mesa
            batch.delete(doc.ref);
        });
        
        if (snapshot.size > 0) {
            await batch.commit();
            console.log(`Limpeza: ${snapshot.size} mesas abandonadas removidas`);
        }
    } catch (error) {
        console.error('Erro na limpeza de mesas:', error);
    }
}









// ===== FUNÇÃO UPDATE TABLES LIST (NOVA) =====
function updateTablesList() {
    // Forçar recarregamento das mesas
    loadTables();
}

// ===== VARIÁVEIS GLOBAIS PARA ESPECTADORES =====
let spectatorsListener = null;
let currentSpectators = [];
let userSupporting = null;

// ===== FUNÇÃO JOIN AS SPECTATOR =====
async function joinAsSpectator(tableId) {
    try {
        const tableRef = db.collection('tables').doc(tableId);
        const tableDoc = await tableRef.get();
        
        if (!tableDoc.exists) {
            showNotification('Mesa não encontrada', 'error');
            return;
        }
        
        const table = tableDoc.data();
        
        // Verificar se a mesa está jogando
        if (table.status !== 'playing') {
            showNotification('Só é possível assistir mesas em andamento', 'error');
            return;
        }
        
        // Verificar se usuário já é jogador
        if (table.players.some(p => p.uid === currentUser.uid)) {
            showNotification('Você já está jogando nesta mesa', 'error');
            return;
        }
        
        // Entrar como espectador
        await tableRef.collection('spectators').doc(currentUser.uid).set({
            displayName: userData.displayName,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
            supporting: null // Inicialmente não torce para ninguém
        });
        
        // Configurar listeners para assistir o jogo
        setupGameListener(tableId, true); // true = modo espectador
        setupSpectatorsListener(tableId);
        
        showScreen('game-screen');
        showNotification('Você entrou como espectador', 'success');
        
    } catch (error) {
        console.error('Erro ao entrar como espectador:', error);
        showNotification('Erro ao assistir jogo: ' + error.message, 'error');
    }
}

// ===== SETUP SPECTATORS LISTENER CORRIGIDA =====
function setupSpectatorsListener(tableId) {
    if (spectatorsListener) spectatorsListener();
    
    spectatorsListener = db.collection('tables')
        .doc(tableId)
        .collection('spectators')
        .onSnapshot(async (snapshot) => {
            const oldSpectators = [...currentSpectators];
            currentSpectators = [];
            
            snapshot.forEach((doc) => {
                currentSpectators.push({ id: doc.id, ...doc.data() });
            });
            
          
            
            // Atualizar badge do botão
            const badge = document.getElementById('spectators-count');
            if (badge) {
                badge.textContent = currentSpectators.length;
                badge.style.display = currentSpectators.length > 0 ? 'flex' : 'none';
            }
            
            // Atualizar modal se estiver aberto
            if (spectatorsModal && spectatorsModal.classList.contains('active')) {
                updateSpectatorsModal();
            }
            
            // Atualizar UI dos espectadores
            updateSpectatorsUI(oldSpectators);
            
        }, (error) => {
            console.error('Erro no listener de espectadores:', error);
        });
}


// ===== ATUALIZAR SPECTATORS UI CORRIGIDA =====
function updateSpectatorsUI(oldSpectators = []) {
     const spectatorsContainer = document.getElementById('spectators-container');
    const supportersContainer = document.getElementById('supporters-container');
    const spectatorsCountBadge = document.querySelector('.spectators-count-badge');
    
    if (!spectatorsContainer || !supportersContainer) return;
    
    // Atualizar contador na mesa principal (se tableId for fornecido)
    if (tableId) {
        updateTableSpectatorsCount(tableId, currentSpectators.length);
    }
    
    
    // Atualizar contador
    if (spectatorsCountBadge) {
        spectatorsCountBadge.innerHTML = `<i class="fas fa-eye"></i> ${currentSpectators.length}`;
    }
    
    // Lista de espectadores
    spectatorsContainer.innerHTML = `
        <div class="spectators-list">
            ${currentSpectators.map(spec => `
                <div class="spectator-item">
                    <div class="spectator-avatar">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(spec.displayName)}&background=random" alt="${spec.displayName}">
                    </div>
                    <span class="spectator-name">${spec.displayName}</span>
                    ${spec.supporting ? `
                        <span class="supporting-badge" style="background: ${spec.supporting === 'black' ? '#2c3e50' : '#e74c3c'}">
                            <i class="fas fa-flag"></i> Torcendo
                        </span>
                    ` : ''}
                </div>
            `).join('')}
            ${currentSpectators.length === 0 ? 
                '<div class="no-spectators"><i class="fas fa-eye-slash"></i> Nenhum espectador</div>' : ''}
        </div>
    `;
    
    // Lista de torcedores por jogador
    const blackSupporters = currentSpectators.filter(s => s.supporting === 'black');
    const redSupporters = currentSpectators.filter(s => s.supporting === 'red');
    const neutralSpectators = currentSpectators.filter(s => !s.supporting);
    
    supportersContainer.innerHTML = `
        <div class="supporters-section">
            <h5 class="supporters-title" style="color: #2c3e50;">
                <i class="fas fa-chess-pawn"></i> Pretas (${blackSupporters.length})
            </h5>
            <div class="supporters-list">
                ${blackSupporters.map(s => `
                    <div class="supporter-item">
                        <div class="supporter-avatar">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.displayName)}&background=2c3e50&color=fff" alt="${s.displayName}">
                        </div>
                        <span class="supporter-name">${s.displayName}</span>
                    </div>
                `).join('')}
                ${blackSupporters.length === 0 ? '<div class="no-supporters"><i class="fas fa-heart-broken"></i> Ninguém torcendo</div>' : ''}
            </div>
        </div>
        
        <div class="supporters-section">
            <h5 class="supporters-title" style="color: #e74c3c;">
                <i class="fas fa-chess-pawn"></i> Vermelhas (${redSupporters.length})
            </h5>
            <div class="supporters-list">
                ${redSupporters.map(s => `
                    <div class="supporter-item">
                        <div class="supporter-avatar">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.displayName)}&background=e74c3c&color=fff" alt="${s.displayName}">
                        </div>
                        <span class="supporter-name">${s.displayName}</span>
                    </div>
                `).join('')}
                ${redSupporters.length === 0 ? '<div class="no-supporters"><i class="fas fa-heart-broken"></i> Ninguém torcendo</div>' : ''}
            </div>
        </div>
        
        <div class="supporters-section">
            <h5 class="supporters-title" style="color: #7f8c8d;">
                <i class="fas fa-eye"></i> Neutros (${neutralSpectators.length})
            </h5>
            <div class="supporters-list">
                ${neutralSpectators.map(s => `
                    <div class="supporter-item">
                        <div class="supporter-avatar">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.displayName)}&background=7f8c8d&color=fff" alt="${s.displayName}">
                        </div>
                        <span class="supporter-name">${s.displayName}</span>
                    </div>
                `).join('')}
                ${neutralSpectators.length === 0 ? '<div class="no-supporters"><i class="fas fa-user"></i> Nenhum espectador neutro</div>' : ''}
            </div>
        </div>
    `;
    
    // Mostrar notificação para jogadores quando alguém torce por eles
    const isPlayer = gameState && gameState.players && gameState.players.some(p => p.uid === currentUser.uid);
    if (isPlayer) {
        const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
        
        // Encontrar novos torcedores
        const newSupporters = currentSpectators.filter(newSpec => 
            newSpec.supporting === currentPlayer.color && 
            !oldSpectators.some(oldSpec => oldSpec.id === newSpec.id && oldSpec.supporting === currentPlayer.color)
        );
        
        newSupporters.forEach(supporter => {
            showNotification(`🎉 ${supporter.displayName} está torcendo por você!`, 'success', 3000);
        });
    }
}
// ===== FUNÇÃO SUPPORT PLAYER CORRIGIDA =====
async function supportPlayer(playerColor) {
    if (!currentGameRef || !currentUser || !gameState) {
        showNotification('Você precisa estar assistindo um jogo', 'error');
        return;
    }
    
    // Verificar se a cor é válida
    const validColors = ['black', 'red'];
    if (!validColors.includes(playerColor)) {
        showNotification('Cor de jogador inválida', 'error');
        return;
    }
    
    try {
        const spectatorRef = db.collection('tables')
            .doc(currentGameRef.id)
            .collection('spectators')
            .doc(currentUser.uid);
        
        // Verificar se já está torcendo para esta cor
        if (userSupporting === playerColor) {
            // Parar de torcer
            await spectatorRef.update({
                supporting: null
            });
            userSupporting = null;
            showNotification('Você parou de torcer', 'info');
        } else {
            // Torcer para o jogador
            await spectatorRef.update({
                supporting: playerColor,
                supportedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            userSupporting = playerColor;
            
            const player = gameState.players.find(p => p.color === playerColor);
            const playerName = player?.displayName || (playerColor === 'black' ? 'Pretas' : 'Vermelhas');
            
            showNotification(`🎯 Você está torcendo para ${playerName}!`, 'success');
            
            // Notificar o jogador se estiver online
            if (player && player.uid !== currentUser.uid) {
                await db.collection('notifications').add({
                    type: 'new_supporter',
                    userId: player.uid,
                    message: `${userData.displayName} está torcendo por você!`,
                    tableId: currentGameRef.id,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false
                });
            }
        }
        
    } catch (error) {
        console.error('Erro ao torcer:', error);
        showNotification('Erro ao torcer: ' + error.message, 'error');
    }
}// ===== RENDER TABLE COM ESPECTADORES CORRIGIDA =====
function renderTable(table, container) {
    const tableEl = document.createElement('div');
    tableEl.className = 'table-item';
    tableEl.dataset.tableId = table.id;
    
    const playerCount = table.players ? table.players.length : 0;
    const isPlaying = table.status === 'playing';
    const isFinished = table.status === 'finished';
    const isDraw = table.status === 'draw';
    const isWaiting = table.status === 'waiting';
    
    // Obter nomes dos jogadores
    let playersInfo = '';
    if (table.players && table.players.length > 0) {
        playersInfo = table.players.map(player => 
            `<span class="player-name-tag ${player.color}">${player.displayName || 'Jogador'}</span>`
        ).join(' vs ');
    }
    
    let tableStatus = '';
    let actionButton = '';
    
    if (isFinished || isDraw) {
        const resultClass = isDraw ? 'draw-result' : 'win-result';
        tableStatus = `
            <div class="table-result ${resultClass}">${table.resultText || (isDraw ? 'Empate' : 'Jogo finalizado')}</div>
            ${playersInfo ? `<div class="table-players">${playersInfo}</div>` : ''}
        `;
        actionButton = `<button class="btn btn-secondary btn-small" disabled>Finalizado</button>`;
    } else if (isPlaying) {
        tableStatus = `
            <div class="table-status">Jogando</div>
            ${playersInfo ? `<div class="table-players">${playersInfo}</div>` : ''}
            <div class="spectators-count">
                <i class="fas fa-eye"></i> ${table.spectatorsCount || 0} espectadores
            </div>
        `;
        
        const isUserInTable = table.players && table.players.some(p => p.uid === currentUser?.uid);
        
        if (isUserInTable) {
            actionButton = `<button class="btn btn-warning btn-small" disabled>Jogando</button>`;
        } else {
            actionButton = `
                <button class="btn btn-info btn-small watch-btn">
                    <i class="fas fa-eye"></i> Assistir (${table.spectatorsCount || 0})
                </button>
            `;
        }
    } else if (isWaiting) {
        tableStatus = `
            <div class="table-status waiting">Aguardando jogador</div>
            ${playersInfo ? `<div class="table-players">${playersInfo}</div>` : ''}
        `;
        actionButton = `<button class="btn btn-primary btn-small join-btn">Entrar</button>`;
    }
    
    tableEl.innerHTML = `
        <div class="table-info">
            <div class="table-name">${table.name || `Mesa ${table.id.substring(0, 8)}`}</div>
            <div class="table-details">
                <span><i class="fas fa-users"></i> ${playerCount}/2</span>
                <span><i class="fas fa-clock"></i> ${table.timeLimit || 0}s</span>
                ${table.bet > 0 ? `<span><i class="fas fa-coins"></i> ${table.bet}</span>` : ''}
            </div>
            ${tableStatus}
        </div>
        <div class="table-actions">
            ${actionButton}
        </div>
    `;
    
    if (isWaiting) {
        const joinBtn = tableEl.querySelector('.join-btn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => joinTable(table.id));
        }
    } else if (isPlaying && !table.players.some(p => p.uid === currentUser?.uid)) {
        const watchBtn = tableEl.querySelector('.watch-btn');
        if (watchBtn) {
            watchBtn.addEventListener('click', () => joinAsSpectator(table.id));
        }
    }
    
    if (isFinished || isDraw) {
        tableEl.classList.add('table-finished');
        if (isDraw) tableEl.classList.add('table-draw');
    }
    
    container.appendChild(tableEl);
}


// ===== SETUP GAME LISTENER COMPLETAMENTE ROTEAWRITTEN =====
// ===== SETUP GAME LISTENER (CORRIGIDA) =====
function setupGameListener(tableId) {
    console.log('🔄 Iniciando listener do jogo para mesa:', tableId);
    
    // ✅ VERIFICAÇÃO EXTRA: Garantir que tableId existe
    if (typeof tableId === 'undefined') {
        console.error('❌ tableId não definido em setupGameListener');
        
        // Tentar obter tableId de outras fontes
        if (userActiveTable) {
            tableId = userActiveTable;
            console.log('🔄 Usando userActiveTable como tableId:', tableId);
        } else if (currentGameRef) {
            tableId = currentGameRef.id;
            console.log('🔄 Usando currentGameRef.id como tableId:', tableId);
        } else {
            console.error('❌ Não foi possível determinar tableId');
            showNotification('Erro ao conectar com o jogo', 'error');
            return;
        }
    }
    
    // Remover listener anterior se existir
    if (gameListener) {
        console.log('🗑️ Removendo listener anterior');
        gameListener();
        gameListener = null;
    }
    
    // ✅ VERIFICAÇÃO CRÍTICA: Garantir que tableId é válido
    if (!tableId || typeof tableId !== 'string' || tableId.trim() === '') {
        console.error('❌ ID da mesa inválido em setupGameListener:', tableId);
        showNotification('Erro ao conectar com o jogo', 'error');
        return;
    }
    
    currentGameRef = db.collection('tables').doc(tableId);
    let lastProcessedStateHash = '';
    let isProcessing = false;
    
    gameListener = currentGameRef.onSnapshot(async (doc) => {
        // Evitar processamento simultâneo
        if (isProcessing) {
            console.log('⏳ Já processando, ignorando chamada duplicada');
            return;
        }
        
        isProcessing = true;
        
        try {
            // ✅ VERIFICAÇÃO: Verificar se a referência ainda é a mesma
            if (!currentGameRef || currentGameRef.id !== tableId) {
                console.log('🔀 Referência mudou, ignorando listener');
                isProcessing = false;
                return;
            }
            
            if (!doc.exists) {
                console.log('❌ Documento não existe mais');
                showNotification('A mesa foi encerrada', 'info');
                leaveGame();
                isProcessing = false;
                return;
            }
            
            const newGameState = doc.data();
            const newStateHash = JSON.stringify(newGameState);
            
            // ✅ VERIFICAÇÃO: Garantir que newGameState existe
            if (!newGameState) {
                console.error('❌ newGameState é null ou undefined');
                isProcessing = false;
                return;
            }
            
            // Verificar se o estado realmente mudou
            if (newStateHash === lastProcessedStateHash) {
                console.log('⚡ Estado inalterado, ignorando update');
                isProcessing = false;
                return;
            }
            
            lastProcessedStateHash = newStateHash;
            const oldGameState = gameState;
            gameState = newGameState;
            
            console.log('🔄 Novo estado do jogo recebido:', gameState.status);
            
            // ✅ VERIFICAÇÃO: Garantir que gameState tem as propriedades necessárias
            if (!gameState.players) gameState.players = [];
            if (!gameState.board) gameState.board = initializeBrazilianCheckersBoard();
            
            // 1. CONVERSÃO DO TABULEIRO (se necessário)
            if (gameState.board && typeof gameState.board === 'object' && !Array.isArray(gameState.board)) {
                gameState.board = convertFirestoreFormatToBoard(gameState.board);
            }
            
            // ✅ VERIFICAÇÃO: Garantir que gameState.status existe
            if (!gameState.status) {
                console.error('❌ gameState.status não definido');
                gameState.status = 'waiting'; // Valor padrão
            }
            
            // 2. VERIFICAR SE JOGO TERMINOU
            if (gameState.status === 'finished' || gameState.status === 'draw') {
                console.log('🏁 Jogo finalizado, processando estado final');
                await handleFinishedGame(oldGameState, gameState);
                isProcessing = false;
                return;
            }
            
            // DETECTAR MUDANÇAS IMPORTANTES
            const boardChanged = !oldGameState || 
                               JSON.stringify(oldGameState.board) !== JSON.stringify(gameState.board);
            
            const turnChanged = !oldGameState || 
                              oldGameState.currentTurn !== gameState.currentTurn;
            
            const playersChanged = !oldGameState || 
                                 JSON.stringify(oldGameState.players) !== JSON.stringify(gameState.players);
            
            // PROCESSAR EVENTOS ESPECÍFICOS
            if (playersChanged && oldGameState) {
                await handlePlayersChange(oldGameState, gameState);
            }
            
            if (gameState.drawOffer && (!oldGameState || !oldGameState.drawOffer)) {
                await handleDrawOffer(gameState.drawOffer);
            }
            
            // ATUALIZAR INTERFACE (APENAS SE NECESSÁRIO)
            if (boardChanged || turnChanged || playersChanged) {
                console.log('🎨 Atualizando interface');
                updateGameInterface();
            }
            
            // GERENCIAR TIMER
            manageGameTimer(oldGameState, gameState);
            
            // INICIALIZAR SISTEMAS SECUNDÁRIOS
            if (gameState.status === 'playing' && (!oldGameState || oldGameState.status !== 'playing')) {
                console.log('🎮 Jogo iniciado, configurando sistemas');
                setupChatListener();
                setupSpectatorsListener(tableId);
            }
            
            // VERIFICAR FIM DE JOGO
            if (boardChanged && gameState.status === 'playing') {
                checkGameEnd(gameState.board, gameState.currentTurn);
            }
            
        } catch (error) {
            console.error('💥 Erro crítico no listener:', error);
            showNotification('Erro de conexão com o jogo', 'error');
        } finally {
            isProcessing = false;
        }
        
    }, (error) => {
        console.error('📡 Erro no listener:', error);
        
        if (error.code !== 'cancelled') {
            showNotification('Erro de conexão com o jogo', 'error');
            
            if (error.code === 'permission-denied' || error.code === 'not-found') {
                setTimeout(() => leaveGame(), 2000);
            }
        }
    });
}



// ===== FUNÇÃO COMPARE PLAYERS =====
function comparePlayers(oldPlayers, newPlayers) {
    if (!oldPlayers && !newPlayers) return { added: [], removed: [], changed: [] };
    
    const oldPlayersList = oldPlayers || [];
    const newPlayersList = newPlayers || [];
    
    const added = newPlayersList.filter(newPlayer => 
        !oldPlayersList.some(oldPlayer => oldPlayer.uid === newPlayer.uid)
    );
    
    const removed = oldPlayersList.filter(oldPlayer => 
        !newPlayersList.some(newPlayer => newPlayer.uid === oldPlayer.uid)
    );
    
    const changed = newPlayersList.filter(newPlayer => {
        const oldPlayer = oldPlayersList.find(p => p.uid === newPlayer.uid);
        return oldPlayer && JSON.stringify(oldPlayer) !== JSON.stringify(newPlayer);
    });
    
    return { added, removed, changed };
}


// ===== FUNÇÃO HANDLE PLAYERS CHANGE =====
async function handlePlayersChange(oldGameState, newGameState) {
    console.log('👥 Mudança detectada nos jogadores');
    
    if (!oldGameState || !newGameState || !newGameState.players) return;
    
    const oldPlayers = oldGameState.players || [];
    const newPlayers = newGameState.players || [];
    
    // Verificar se um jogador entrou na mesa
    if (newPlayers.length > oldPlayers.length) {
        const newPlayer = newPlayers.find(player => 
            !oldPlayers.some(oldPlayer => oldPlayer.uid === player.uid)
        );
        
        if (newPlayer) {
            console.log('🎉 Novo jogador entrou:', newPlayer.displayName);
            
            // Se o jogo estava esperando e agora tem 2 jogadores, iniciar
            if (oldGameState.status === 'waiting' && newGameState.status === 'playing') {
                showNotification(`Jogo iniciado! ${newPlayer.displayName} entrou na mesa.`, 'success');
                
                // Notificar ambos os jogadores
                await notifyBothPlayers('O jogo começou! Boa sorte!', 'info');
            }
        }
    }
    
    // Verificar se um jogador saiu da mesa
    if (newPlayers.length < oldPlayers.length) {
        const leftPlayer = oldPlayers.find(player => 
            !newPlayers.some(newPlayer => newPlayer.uid === player.uid)
        );
        
        if (leftPlayer) {
            console.log('🚪 Jogador saiu:', leftPlayer.displayName);
            
            // Se era um jogo em andamento e alguém saiu
            if (oldGameState.status === 'playing') {
                showNotification(`${leftPlayer.displayName} saiu do jogo.`, 'warning');
                
                // Se o usuário atual ainda está no jogo, notificar
                const currentPlayer = newPlayers.find(p => p.uid === currentUser.uid);
                if (currentPlayer) {
                    await db.collection('notifications').add({
                        type: 'player_left',
                        userId: currentUser.uid,
                        message: `${leftPlayer.displayName} abandonou o jogo.`,
                        tableId: currentGameRef.id,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        read: false
                    });
                }
            }
        }
    }
    
    // Verificar mudanças nos dados dos jogadores (rating, nome, etc.)
    newPlayers.forEach(newPlayer => {
        const oldPlayer = oldPlayers.find(p => p.uid === newPlayer.uid);
        if (oldPlayer && JSON.stringify(oldPlayer) !== JSON.stringify(newPlayer)) {
            console.log('📊 Dados do jogador atualizados:', newPlayer.displayName);
        }
    });
}

// ===== FUNÇÃO HANDLE DRAW OFFER =====
async function handleDrawOffer(drawOffer) {
    console.log('🤝 Proposta de empate recebida');
    
    if (!drawOffer || !currentUser) return;
    
    // Verificar se a proposta é para o usuário atual
    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
    if (!currentPlayer || drawOffer.from === currentUser.uid) return;
    
    // Mostrar notificação da proposta
    showNotification(`${drawOffer.senderName} ofereceu empate.`, 'info');
    
    // Adicionar notificação no sistema
    await db.collection('notifications').add({
        type: 'draw_offer',
        userId: currentUser.uid,
        message: `${drawOffer.senderName} ofereceu empate. Clique para responder.`,
        tableId: currentGameRef.id,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false,
        drawOffer: drawOffer
    });
}

// ===== FUNÇÃO HANDLE FINISHED GAME =====
async function handleFinishedGame(oldGameState, newGameState) {
    console.log('🏁 Processando jogo finalizado');
    
    if (!newGameState || newGameState.status !== 'finished') return;
    
    // Verificar se o usuário atual estava neste jogo
    const wasPlayer = newGameState.players && newGameState.players.some(p => p.uid === currentUser.uid);
    
    if (wasPlayer) {
        // Processar resultados para jogadores
        await processGameResults(newGameState);
    }
    
    // Renderizar estado final do tabuleiro
    if (newGameState.board) {
        renderBoard(newGameState.board);
    }
    
    // Mostrar mensagem de resultado
    showNotification(newGameState.resultText || 'Jogo finalizado', 'info');
    
    // Se foi um jogador, redirecionar após delay
    if (wasPlayer) {
        setTimeout(() => {
            leaveGame();
        }, 5000);
    }
}

// ===== FUNÇÃO PROCESS GAME RESULTS =====
async function processGameResults(gameState) {
    if (!gameState || !currentUser) return;
    
    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
    if (!currentPlayer) return;
    
    // Verificar resultado
    if (gameState.status === 'draw') {
        showNotification('Empate! A aposta foi devolvida.', 'info');
    } else if (gameState.winner === currentPlayer.color) {
        showNotification('Vitória! 🎉', 'success');
        
        // Adicionar notificação de vitória
        await db.collection('notifications').add({
            type: 'game_win',
            userId: currentUser.uid,
            message: `Você venceu contra ${gameState.players.find(p => p.uid !== currentUser.uid)?.displayName || 'oponente'}!`,
            tableId: currentGameRef.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });
    } else {
        showNotification('Derrota. Melhor sorte na próxima!', 'error');
    }
}

// ===== FUNÇÃO NOTIFY BOTH PLAYERS =====
async function notifyBothPlayers(message, type = 'info') {
    if (!gameState || !gameState.players) return;
    
    try {
        for (const player of gameState.players) {
            if (player.uid) {
                await db.collection('notifications').add({
                    type: 'game_notification',
                    userId: player.uid,
                    message: message,
                    tableId: currentGameRef.id,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    notificationType: type,
                    read: false
                });
            }
        }
    } catch (error) {
        console.error('Erro ao enviar notificações:', error);
    }
}
// ===== FUNÇÃO UPDATE GAME INTERFACE (COM VERIFICAÇÕES ROBUSTAS) =====
function updateGameInterface() {
    if (!gameState) {
        console.warn('gameState não definido em updateGameInterface');
        return;
    }
    
    console.log('Atualizando interface do jogo...');
    
    try {
        // 1. Renderizar o tabuleiro (com verificação)
        if (gameState.board) {
            renderBoard(gameState.board);
        } else {
            console.warn('gameState.board não definido');
        }
        
        // 2. Atualizar informações dos jogadores (com verificação)
        if (gameState.players) {
            updatePlayerInfo();
        }
        
        // 3. Atualizar informações do turno
        updateTurnInfo();
        
        // 4. Atualizar contagem de peças
        updatePiecesCount();
        
        // 5. Atualizar informações de espectadores (se aplicável)
        if (typeof updateSpectatorsUI === 'function') {
            updateSpectatorsUI();
        }
        
        // 6. Verificar e mostrar proposta de empate se existir
        if (gameState.drawOffer) {
            renderDrawOfferIndicator();
        }
        
        // 7. Atualizar informações da partida
        updateGameStatusInfo();
        
    } catch (error) {
        console.error('Erro em updateGameInterface:', error);
    }
}
// ===== FUNÇÃO UPDATE GAME STATUS INFO =====
function updateGameStatusInfo() {
    if (!gameState) return;
    
    const statusElement = document.getElementById('game-status');
    const betElement = document.getElementById('game-bet');
    const timerElement = document.getElementById('game-timer-display');
    
    if (statusElement) {
        let statusText = '';
        switch (gameState.status) {
            case 'waiting':
                statusText = '🕐 Aguardando oponente...';
                break;
            case 'playing':
                const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
                if (currentPlayer && currentPlayer.color === gameState.currentTurn) {
                    statusText = '✅ Sua vez!';
                } else {
                    statusText = '⏳ Vez do oponente';
                }
                break;
            case 'finished':
                statusText = gameState.resultText || '🏁 Jogo finalizado';
                break;
            case 'draw':
                statusText = '🤝 Empate';
                break;
            default:
                statusText = '❓ Status desconhecido';
        }
        statusElement.textContent = statusText;
    }
    
    if (betElement && gameState.bet > 0) {
        betElement.textContent = `Aposta: ${gameState.bet} moedas`;
        betElement.style.display = 'block';
    } else if (betElement) {
        betElement.style.display = 'none';
    }
    
    if (timerElement && gameState.timeLimit > 0) {
        timerElement.textContent = `Tempo: ${gameState.timeLimit}s por jogada`;
        timerElement.style.display = 'block';
    } else if (timerElement) {
        timerElement.style.display = 'none';
    }
}
// ===== FUNÇÕES AUXILIARES =====


// ===== RENDERIZAR INDICADOR DE PROPOSTA DE EMPATE =====
function renderDrawOfferIndicator() {
    if (!gameState || !gameState.drawOffer) return;
    
    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
    
    // Se a proposta é do usuário atual (ele está esperando)
    if (gameState.drawOffer.from === currentUser.uid) {
        const drawOfferEl = document.createElement('div');
        drawOfferEl.className = 'draw-offer-indicator waiting';
        drawOfferEl.innerHTML = `
            <div class="draw-offer-content">
                <i class="fas fa-clock"></i>
                <span>Proposta de empate enviada...</span>
                <button class="btn btn-small btn-secondary" id="btn-cancel-draw">Cancelar</button>
            </div>
        `;
        
        const gameHeader = document.querySelector('.game-header');
        if (gameHeader && !document.getElementById('draw-offer-indicator')) {
            drawOfferEl.id = 'draw-offer-indicator';
            gameHeader.appendChild(drawOfferEl);
            
            // Event listener para cancelar
            document.getElementById('btn-cancel-draw').addEventListener('click', async () => {
                await currentGameRef.update({
                    drawOffer: null
                });
                showNotification('Proposta de empate cancelada', 'info');
            });
        }
    }
    
    // Se a proposta é para o usuário atual (ele precisa responder)
    else if (currentPlayer && gameState.drawOffer.from !== currentUser.uid) {
        const drawOfferEl = document.createElement('div');
        drawOfferEl.className = 'draw-offer-indicator incoming';
        drawOfferEl.innerHTML = `
            <div class="draw-offer-content">
                <i class="fas fa-handshake"></i>
                <span>${gameState.drawOffer.senderName} ofereceu empate</span>
                <div class="draw-offer-buttons">
                    <button class="btn btn-small btn-success" id="btn-accept-draw">Aceitar</button>
                    <button class="btn btn-small btn-danger" id="btn-decline-draw">Recusar</button>
                </div>
            </div>
        `;
        
        const gameHeader = document.querySelector('.game-header');
        if (gameHeader && !document.getElementById('draw-offer-indicator')) {
            drawOfferEl.id = 'draw-offer-indicator';
            gameHeader.appendChild(drawOfferEl);
            
            // Event listeners
            document.getElementById('btn-accept-draw').addEventListener('click', async () => {
                await endGame('draw');
                await currentGameRef.update({
                    drawOffer: null
                });
            });
            
            document.getElementById('btn-decline-draw').addEventListener('click', async () => {
                await currentGameRef.update({
                    drawOffer: null
                });
                showNotification('Proposta de empate recusada', 'info');
            });
        }
    }
}


// ===== SISTEMA DE NOTIFICAÇÕES =====
function initializeNotifications() {
    // Verificar se usuário está logado
    if (!activeNotifications) {
    activeNotifications = new Map();
}
    if (!currentUser) return;
    
    // Listener para notificações
    db.collection('notifications')
        .where('userId', '==', currentUser.uid)
        .where('read', '==', false)
        .orderBy('timestamp', 'desc')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const notification = change.doc.data();
                    showGameNotification(notification.message);
                    
                    // Marcar como lida
                    db.collection('notifications').doc(change.doc.id).update({
                        read: true
                    });
                }
            });
        });
}

// ===== FUNÇÃO PARA MOSTRAR NOTIFICAÇÃO DE JOGO =====
function showGameNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'game-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-info-circle"></i>
            <span>${message}</span>
        </div>
    `;
     if (onClick) {
        notification.style.cursor = 'pointer';
        notification.addEventListener('click', onClick);
    }

    
    document.body.appendChild(notification);
    
    // Animação de entrada
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Remover após 5 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}


function isGameRefValid() {
    return currentGameRef !== null && 
           currentGameRef !== undefined && 
           typeof currentGameRef.update === 'function';
}

// ===== ATUALIZAR A CHAMADA DE ENDGAME =====
// Em todos os lugares onde endGame é chamado, verificar primeiro:
function safeEndGame(result) {
    if (isGameRefValid() && gameState) {
        endGameSafe(result); // Usar a versão segura
    } else {
        console.log('Não é possível finalizar jogo - referência inválida');
        leaveGame();
    }
}

// ===== ATUALIZAR SETUP SPECTATOR UI PARA JOGADORES TAMBÉM =====
function setupSpectatorUI() {
    // Adicionar botões de torcida (apenas para espectadores)
    const gameHeader = document.querySelector('.game-header');
    if (gameHeader && !document.getElementById('support-buttons')) {
        const isPlayer = gameState.players.some(p => p.uid === currentUser.uid);
        
        if (!isPlayer) {
            const supportButtons = `
                <div id="support-buttons" class="support-buttons">
                    <button class="btn btn-dark btn-small support-btn" data-color="black">
                        <i class="fas fa-flag"></i> Torcer Pretas
                    </button>
                    <button class="btn btn-danger btn-small support-btn" data-color="red">
                        <i class="fas fa-flag"></i> Torcer Vermelhas
                    </button>
                </div>
            `;
            gameHeader.insertAdjacentHTML('beforeend', supportButtons);
            
            document.querySelectorAll('.support-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    supportPlayer(e.target.dataset.color);
                });
            });
        }
    }
    
    // Mostrar painel de espectadores (para todos)
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer && !document.getElementById('spectators-panel')) {
        const isPlayer = gameState.players.some(p => p.uid === currentUser.uid);
        const panelTitle = isPlayer ? "Público da Partida" : "Espectadores";
        
        const spectatorsPanel = `
            <div id="spectators-panel" class="spectators-panel">
                <div class="panel-header">
                    <h4>${panelTitle}</h4>
                    <span class="spectators-count-badge">
                        <i class="fas fa-eye"></i> ${currentSpectators.length}
                    </span>
                </div>
                <div id="spectators-container" class="panel-content"></div>
                
                <div class="panel-header">
                    <h4>Torcedores</h4>
                </div>
                <div id="supporters-container" class="panel-content"></div>
            </div>
        `;
        gameContainer.insertAdjacentHTML('beforeend', spectatorsPanel);
    }
}


// ===== FUNÇÃO LEAVE GAME CORRIGIDA =====
function leaveGame() {


    console.log('Saindo do jogo...');
        cleanupGameVoiceChat();


    // Remover listener do jogo primeiro
    if (gameListener) {
        gameListener();
        gameListener = null;
    }
    
    // Fechar modal de espectadores se estiver aberto
    if (spectatorsModal) {
        closeSpectatorsModal();
    }
    
    // Se era espectador, remover da lista
    if (currentGameRef && currentUser) {
        const isPlayer = gameState && gameState.players && 
                        gameState.players.some(p => p.uid === currentUser.uid);
        
        if (!isPlayer) {
            db.collection('tables')
                .doc(currentGameRef.id)
                .collection('spectators')
                .doc(currentUser.uid)
                .delete()
                .catch(error => console.error('Erro ao sair como espectador:', error));
        }
    }
    
    // Limpar referências - IMPORTANTE: fazer isso por último
    const oldGameRef = currentGameRef;
    currentGameRef = null;
    gameState = null;
    selectedPiece = null;
    currentSpectators = [];
    userSupporting = null;
    userActiveTable = null;
    // Voltar para a tela principal
    showScreen('main-screen');
    loadTables();
    cleanupDrawOffer();
    stopMoveTimer();
    updateCreateButtonStatus();

    
    
    console.log('Jogo finalizado e recursos limpos');
}


// ===== INICIALIZAR VERIFICAÇÃO DE MESA ATIVA =====
async function initializeTableCheck() {
    if (currentUser) {
        const hasActiveTable = await checkUserActiveTable();
        if (hasActiveTable) {
            showNotification('Você tem uma mesa ativa. Redirecionando...', 'info');
            
            // Entrar automaticamente na mesa existente
            setTimeout(() => {
                joinTable(userActiveTable);
            }, 2000);
        }
    }
}





// ===== FUNÇÃO HANDLE CELL CLICK (VERIFICAÇÃO FINAL) =====
function handleCellClick(row, col) {
const originalHandleCellClick = handleCellClick;
handleCellClick = function(row, col) {
    audioManager.playClickSound();
    return originalHandleCellClick.call(this, row, col);
};
    if (!selectedPiece) return;
    
    const moves = getPossibleMoves(selectedPiece.row, selectedPiece.col);
    const validMove = moves.find(m => m.toRow === row && m.toCol === col);
    
    if (validMove) {
        makeMove(selectedPiece.row, selectedPiece.col, row, col, validMove.captures);
    } else {
        showNotification('Movimento inválido!', 'error');
    }
    
    clearSelection();
}

// ===== FUNÇÃO PARA DESTACAR PEÇAS QUE PODEM CAPTURAR =====
function highlightCapturingPieces() {
    capturingPieces.forEach(piece => {
        const pieceEl = document.querySelector(`.checker-piece[data-row="${piece.row}"][data-col="${piece.col}"]`);
        if (pieceEl) {
            pieceEl.classList.add('capture-possible');
            pieceEl.style.boxShadow = '0 0 10px yellow';
        }
    });
}

// ===== FUNÇÃO HANDLE PIECE CLICK (ATUALIZADA) =====
function handlePieceClick(row, col) {
       const originalHandlePieceClick = handlePieceClick;
handlePieceClick = function(row, col) {
    audioManager.playClickSound();
    return originalHandlePieceClick.call(this, row, col);
};

    console.log('Peça clicada:', row, col);
    
    if (!gameState || !gameState.board) {
        showNotification('Jogo não carregado', 'error');
        return;
    }
    
    const piece = gameState.board[row][col];
    if (!piece) return;
    
    // Verificar se é a vez do jogador
    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
    if (!currentPlayer || piece.color !== currentPlayer.color) {
        showNotification('Não é sua vez de jogar', 'warning');
        return;
    }
    
    // Verificar se é a vez deste jogador
    if (piece.color !== gameState.currentTurn) {
        showNotification('Aguarde sua vez', 'info');
        return;
    }
    
    // Verificar capturas obrigatórias
    if (hasGlobalMandatoryCaptures) {
        const canThisPieceCapture = capturingPieces.some(p => p.row === row && p.col === col);
        if (!canThisPieceCapture) {
            showNotification('Você deve selecionar uma peça que possa capturar!', 'error');
            return;
        }
    }
    
    // Limpar seleção anterior
    clearSelection();
    
    // Selecionar nova peça
    selectedPiece = { row, col };
    
    // Aplicar efeito visual de seleção
    const pieceEl = document.querySelector(`.checker-piece[data-row="${row}"][data-col="${col}"]`);
    if (pieceEl) {
        pieceEl.classList.add('selected');
        showPossibleMoves(row, col);
        
        // Feedback sonoro (opcional)
        playSelectionSound();
    }
    
    console.log('Peça selecionada:', selectedPiece);
}

// ===== FUNÇÃO SHOW POSSIBLE MOVES (ATUALIZADA) =====
function showPossibleMoves(row, col) {
    clearHighlights();
    
    const moves = getPossibleMoves(row, col);
    console.log('Movimentos possíveis:', moves);
    
    moves.forEach(move => {
        const cell = document.querySelector(`.board-cell[data-row="${move.toRow}"][data-col="${move.toCol}"]`);
        if (cell) {
            if (move.captures && move.captures.length > 0) {
                cell.classList.add('capture-highlight');
                cell.title = `Captura ${move.captures.length} peça(s)`;
                
                // Destacar peças que serão capturadas
                move.captures.forEach(capture => {
                    const pieceEl = document.querySelector(`.checker-piece[data-row="${capture.row}"][data-col="${capture.col}"]`);
                    if (pieceEl) {
                        pieceEl.classList.add('capture-target');
                    }
                });
            } else {
                cell.classList.add('highlighted');
                cell.title = 'Movimento simples';
            }
        }
    });
}


// ===== FEEDBACK SONORO (OPCIONAL) =====
function playSelectionSound() {
    try {
        // Criar um som simples de seleção
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.1);
        oscillator.stop(context.currentTime + 0.1);
        
    } catch (error) {
        console.log('Áudio não disponível');
    }
}


// ===== FUNÇÃO CLEAR HIGHLIGHTS (ATUALIZADA) =====
function clearHighlights() {
    // Remover highlights das células
    document.querySelectorAll('.board-cell.highlighted, .board-cell.capture-highlight').forEach(cell => {
        cell.classList.remove('highlighted', 'capture-highlight');
    });
    
    // Remover highlights das peças
    document.querySelectorAll('.checker-piece.capture-target').forEach(piece => {
        piece.classList.remove('capture-target');
    });
}

// ===== FUNÇÃO CLEAR SELECTION =====
function clearSelection() {
  selectedPiece = null;
  clearHighlights();
  
  const selectedEl = document.querySelector('.checker-piece.selected');
  if (selectedEl) {
    selectedEl.classList.remove('selected');
  }
}


// ===== FUNÇÃO IS VALID MOVE =====
function isValidMove(fromRow, fromCol, toRow, toCol) {
  // Verificar se está dentro do tabuleiro
  if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) {
    return false;
  }
  
  // Verificar se a célula de destino está vazia
  if (gameState.board[toRow][toCol] !== null) {
    return false;
  }
  
  // Verificar se é uma casa escura (onde as peças podem se mover)
  if ((toRow + toCol) % 2 === 0) {
    return false;
  }
  
  return true;
}
// ===== FUNÇÃO UPDATE PLAYER INFO (COMPLETA) =====
function updatePlayerInfo() {
    if (!gameState || !gameState.players) return;
    
    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
    const opponent = gameState.players.find(p => p.uid !== currentUser.uid);
    
    // Atualizar header com nomes dos jogadores
    updateGameHeader(currentPlayer, opponent);
    
    // Atualizar cartas dos jogadores se existirem
    updatePlayerCards(currentPlayer, opponent);
    
    // Atualizar informações de rating e estatísticas
    updatePlayerStats(currentPlayer, opponent);
}

// ===== FUNÇÃO AUXILIAR PARA UPDATE PLAYER CARDS =====
function updatePlayerCards(currentPlayer, isMyTurn) {
    // Esta função parece estar sendo chamada com parâmetros diferentes
    // Vamos criar uma versão segura
    
    try {
        // Atualizar carta do jogador atual
        const myCard = document.querySelector('.player-card.me');
        if (myCard) {
            if (isMyTurn) {
                myCard.classList.add('active-turn');
                myCard.style.borderColor = '#2ecc71';
                const nameElement = myCard.querySelector('.player-name');
                if (nameElement) nameElement.style.color = '#2ecc71';
            } else {
                myCard.classList.remove('active-turn');
                myCard.style.borderColor = '';
                const nameElement = myCard.querySelector('.player-name');
                if (nameElement) nameElement.style.color = '';
            }
        }
        
        // Atualizar carta do oponente
        const opponentCard = document.querySelector('.player-card.opponent');
        if (opponentCard) {
            if (!isMyTurn) {
                opponentCard.classList.add('active-turn');
                opponentCard.style.borderColor = '#2ecc71';
                const nameElement = opponentCard.querySelector('.player-name');
                if (nameElement) nameElement.style.color = '#2ecc71';
            } else {
                opponentCard.classList.remove('active-turn');
                opponentCard.style.borderColor = '';
                const nameElement = opponentCard.querySelector('.player-name');
                if (nameElement) nameElement.style.color = '';
            }
        }
    } catch (error) {
        console.error('Erro em updatePlayerCards:', error);
    }
}
// ===== FUNÇÃO UPDATE PLAYER STATS =====
function updatePlayerStats(currentPlayer, opponent) {
    // Esta função pode ser expandida para mostrar mais estatísticas
    // como número de peças capturadas, tempo de jogo, etc.
    
    const blackPieces = countPieces('black');
    const redPieces = countPieces('red');
    
    // Atualizar contagem de peças nas cartas
    document.querySelectorAll('.player-stats .pieces').forEach(el => {
        const playerCard = el.closest('.player-card');
        if (playerCard.classList.contains('opponent')) {
            el.textContent = `${redPieces} peça${redPieces !== 1 ? 's' : ''}`;
        } else {
            el.textContent = `${blackPieces} peça${blackPieces !== 1 ? 's' : ''}`;
        }
    });
}

// ===== FUNÇÃO UPDATE GAME HEADER =====
function updateGameHeader(currentPlayer, opponent) {
    const gameHeader = document.querySelector('.game-header');
    if (!gameHeader) return;
    
    // Criar ou atualizar a seção de nomes dos jogadores
    let playersSection = document.querySelector('.players-names');
    if (!playersSection) {
        playersSection = document.createElement('div');
        playersSection.className = 'players-names';
        gameHeader.insertBefore(playersSection, document.querySelector('.header-actions'));
    }
    
    playersSection.innerHTML = `
        <div class="player-vs-player">
            <span class="player-name ${currentPlayer?.color || 'black'}">
                ${currentPlayer?.displayName || 'Você'}
            </span>
            <span class="vs">VS</span>
            <span class="player-name ${opponent?.color || 'red'}">
                ${opponent?.displayName || 'Oponente'}
            </span>
        </div>
    `;
    
    // Atualizar também a versão mobile se existir
    const mobileScore = document.querySelector('.mobile-score');
    if (mobileScore) {
        mobileScore.innerHTML = `
            <span class="player-badge red">${opponent?.displayName?.substring(0, 10) || 'Oponente'}</span>
            <span class="vs">VS</span>
            <span class="player-badge black">${currentPlayer?.displayName?.substring(0, 10) || 'Você'}</span>
        `;
    }
}

// ===== FUNÇÃO SURRENDER FROM GAME (CORRIGIDA) =====
async function surrenderFromGame() {
    console.log('Iniciando processo de desistência...');
    cleanupGameVoiceChat();

    
    if (!currentGameRef || !gameState) {
        showNotification('Nenhum jogo ativo para desistir', 'error');
        return;
    }
    
    try {
        // Mostrar confirmação
        const confirm = await showConfirmModal('Desistir', 'Tem certeza que deseja desistir desta partida?');
        if (!confirm) return;
        
        // Determinar o vencedor (oponente)
        const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
        const winner = currentPlayer.color === 'red' ? 'black' : 'red';
        const winnerPlayer = gameState.players.find(p => p.color === winner);
        
        if (!winnerPlayer) {
            showNotification('Erro: oponente não encontrado', 'error');
            return;
        }
        
        const betAmount = gameState.bet || 0;
        
        if (betAmount > 0) {
            // 🔥 CORREÇÃO: Cálculo correto do prêmio
            const calculation = calculatePrize(betAmount);
            
            // Vencedor recebe o prêmio líquido
            await db.collection('users').doc(winnerPlayer.uid).update({
                coins: firebase.firestore.FieldValue.increment(calculation.winnerPrize),
                wins: firebase.firestore.FieldValue.increment(1),
                rating: firebase.firestore.FieldValue.increment(10)
            });
            
            // Registrar lucro da plataforma
            await db.collection('platformEarnings').add({
                amount: calculation.platformFee,
                betAmount: betAmount,
                tableId: currentGameRef.id,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                winner: winnerPlayer.uid,
                surrendered: true
            });
            
        } else {
            // Sem aposta - apenas estatísticas
            await db.collection('users').doc(winnerPlayer.uid).update({
                wins: firebase.firestore.FieldValue.increment(1),
                rating: firebase.firestore.FieldValue.increment(10)
            });
        }
        
        // Atualizar perdedor
        await db.collection('users').doc(currentUser.uid).update({
            losses: firebase.firestore.FieldValue.increment(1),
            rating: firebase.firestore.FieldValue.increment(-15)
        });
        
        // ENVIAR NOTIFICAÇÃO PARA O OPONENTE
        await db.collection('notifications').add({
            type: 'game_surrender',
            userId: winnerPlayer.uid,
            message: `${currentPlayer.displayName} desistiu do jogo. Você venceu!`,
            tableId: currentGameRef.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });
        
        // Atualizar estado do jogo com informação de desistência
        await currentGameRef.update({
            status: 'finished',
            winner: winner,
            finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
            surrendered: true,
            surrenderedBy: currentUser.uid,
            surrenderedByName: currentPlayer.displayName,
            resultText: `Desistência - Vitória das ${winner}`
        });
        
        showNotification('Você desistiu da partida', 'info');
        
        // Voltar para o lobby após 2 segundos
        setTimeout(() => {
            leaveGame();
        }, 2000);
        
    } catch (error) {
        console.error('Erro ao desistir do jogo:', error);
        showNotification('Erro ao desistir: ' + error.message, 'error');
    }
}
// ===== FUNÇÃO SHOW CONFIRM MODAL =====
async function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    // Criar modal de confirmação se não existir
    let modal = document.getElementById('modal-confirm');
    
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-confirm';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content small">
          <div class="modal-header">
            <h3 id="confirm-title">${title}</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <p id="confirm-message">${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary modal-cancel">Cancelar</button>
            <button id="btn-confirm-action" class="btn btn-primary">Confirmar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      // Atualizar título e mensagem
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-message').textContent = message;
    }
    
    // Mostrar modal
    modal.classList.add('active');
    
    // Configurar event listeners
    const confirmBtn = document.getElementById('btn-confirm-action');
    const cancelBtn = modal.querySelector('.modal-cancel');
    const closeBtn = modal.querySelector('.modal-close');
    
    const cleanUp = () => {
      modal.classList.remove('active');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
    };
    
    const onConfirm = () => {
      cleanUp();
      resolve(true);
    };
    
    const onCancel = () => {
      cleanUp();
      resolve(false);
    };
    
    // Adicionar event listeners
    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
  });
}
// ===== FUNÇÃO CLEAR SELECTION (ATUALIZADA) =====
function clearSelection() {
    // Remover seleção visual de todas as peças
    document.querySelectorAll('.checker-piece.selected').forEach(piece => {
        piece.classList.remove('selected');
    });
    
    // Limpar highlights do tabuleiro
    clearHighlights();
    
    // Limpar variável de seleção
    selectedPiece = null;
}
// ===== FUNÇÃO OFFER DRAW COMPLETA =====
async function offerDraw() {
    console.log('Ofertando empate...');
    
    if (!currentGameRef || !gameState) {
        showNotification('Nenhum jogo ativo para oferecer empate', 'error');
        return;
    }
    
    try {
        const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
        
        // Verificar se já existe uma oferta de empate pendente do oponente
        if (gameState.drawOffer && gameState.drawOffer.from !== currentUser.uid) {
            // Aceitar empate do oponente
            const confirm = await showDrawProposalModal(
                'Proposta de Empate', 
                `${gameState.drawOffer.senderName} ofereceu empate. Aceitar?`
            );
            
            if (confirm) {
                await endGame('draw');
                // Limpar a oferta de empate
                await currentGameRef.update({
                    drawOffer: null
                });
            } else {
                // Recusar empate
                await currentGameRef.update({
                    drawOffer: null
                });
                showNotification('Proposta de empate recusada', 'info');
            }
            return;
        }
        
        // Verificar se já existe uma oferta do próprio jogador
        if (gameState.drawOffer && gameState.drawOffer.from === currentUser.uid) {
            showNotification('Você já enviou uma proposta de empate', 'info');
            return;
        }
        
        // Oferecer empate
        await currentGameRef.update({
            drawOffer: {
                from: currentUser.uid,
                senderName: currentPlayer.displayName,
                senderColor: currentPlayer.color,
                at: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: new Date(Date.now() + 30000) // 30 segundos para expirar
            }
        });
        
        showNotification('Proposta de empate enviada! Aguardando resposta...', 'info');
        
        // Configurar timeout para expirar a oferta
        setTimeout(async () => {
            if (currentGameRef && gameState && gameState.drawOffer && 
                gameState.drawOffer.from === currentUser.uid) {
                try {
                    await currentGameRef.update({
                        drawOffer: null
                    });
                    showNotification('Proposta de empate expirada', 'info');
                } catch (error) {
                    console.error('Erro ao expirar oferta:', error);
                }
            }
        }, 30000);
        
    } catch (error) {
        console.error('Erro ao oferecer empate:', error);
        showNotification('Erro ao oferecer empate: ' + error.message, 'error');
    }
}

// ===== MODAL DE PROPOSTA DE EMPATE =====
async function showDrawProposalModal(title, message) {
    return new Promise((resolve) => {
        // Criar modal de proposta de empate
        const modal = document.createElement('div');
        modal.id = 'modal-draw-proposal';
        modal.className = 'modal draw-proposal-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🤝 ${title}</h3>
                    <div class="draw-timer" id="draw-timer">30s</div>
                </div>
                <div class="modal-body">
                    <div class="draw-proposal-content">
                        <div class="draw-icon">
                            <i class="fas fa-handshake"></i>
                        </div>
                        <p>${message}</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-danger" id="btn-draw-decline">Recusar</button>
                    <button class="btn btn-success" id="btn-draw-accept">Aceitar Empate</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Mostrar modal
        modal.classList.add('active');
        
        // Timer de 30 segundos
        let timeLeft = 30;
        const timerElement = document.getElementById('draw-timer');
        const timerInterval = setInterval(() => {
            timeLeft--;
            if (timerElement) {
                timerElement.textContent = `${timeLeft}s`;
            }
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                cleanupModal();
                resolve(false);
            }
        }, 1000);
        
        const cleanupModal = () => {
            clearInterval(timerInterval);
            modal.classList.remove('active');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        };
        
        // Event listeners
        document.getElementById('btn-draw-accept').addEventListener('click', () => {
            cleanupModal();
            resolve(true);
        });
        
        document.getElementById('btn-draw-decline').addEventListener('click', () => {
            cleanupModal();
            resolve(false);
        });
        
        // Fechar modal clicando fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cleanupModal();
                resolve(false);
            }
        });
    });
}

// ===== FUNÇÃO ENDGAME COMPLETA E CORRIGIDA =====
let isGameEnding = false; // Variável global para controle
// ===== FUNÇÃO ENDGAME CORRIGIDA =====
async function endGame(result) {
const originalEndGame = endGame;
endGame = async function(result) {
    if (result === 'draw') {
        // Som neutro para empate
        audioManager.createSound(500, 0.5, 'sine', 0.3);
    } else {
        const currentPlayer = gameState.players.find(p => p.uid === currentUser?.uid);
        if (currentPlayer && result === currentPlayer.color) {
            audioManager.playVictorySound();
        } else {
            audioManager.playDefeatSound();
        }
    }
    return originalEndGame.apply(this, arguments);
};
    // Prevenir múltiplas execuções
    if (isGameEnding) {
        console.log('endGame já em execução, ignorando chamada duplicada');
        return;
    }
    
    // Verificar se o jogo já está finalizado
    if (gameState && (gameState.status === 'finished' || gameState.status === 'draw')) {
        console.log('Jogo já finalizado, ignorando chamada');
        return;
    }
    
    isGameEnding = true;
    console.log('Iniciando endGame para resultado:', result);
    
    try {
        // Verificar se as referências necessárias existem
        if (!currentGameRef || !gameState || !gameState.players) {
            console.error('Referências inválidas em endGame');
            showNotification('Erro ao finalizar jogo', 'error');
            isGameEnding = false;
            return;
        }
        
        const betAmount = gameState.bet || 0;
        let winner = null;
        let status = 'finished';
        
        // Obter informações dos jogadores
        const blackPlayer = gameState.players.find(p => p.color === 'black');
        const redPlayer = gameState.players.find(p => p.color === 'red');
        
        if (!blackPlayer || !redPlayer) {
            console.error('Jogadores não encontrados');
            showNotification('Erro ao finalizar jogo: jogadores não encontrados', 'error');
            isGameEnding = false;
            return;
        }
        
        if (result === 'draw') {
            status = 'draw';
            console.log('Processando empate...');
            
            // Devolver apostas em caso de empate
            const updates = {};
            
            if (blackPlayer.uid) {
                updates[`users/${blackPlayer.uid}`] = {
                    coins: firebase.firestore.FieldValue.increment(betAmount),
                    draws: firebase.firestore.FieldValue.increment(1),
                    rating: firebase.firestore.FieldValue.increment(2)
                };
            }
            
            if (redPlayer.uid) {
                updates[`users/${redPlayer.uid}`] = {
                    coins: firebase.firestore.FieldValue.increment(betAmount),
                    draws: firebase.firestore.FieldValue.increment(1),
                    rating: firebase.firestore.FieldValue.increment(2)
                };
            }
            
            // Executar todas as atualizações em batch
            const batch = db.batch();
            
            Object.keys(updates).forEach(path => {
                const ref = db.doc(path);
                batch.update(ref, updates[path]);
            });
            
            await batch.commit();
            
            showNotification('Empate! Apostas devolvidas.', 'info');
            
        } else {
            winner = result;
            console.log('Processando vitória para:', winner);
            
            const winningPlayer = gameState.players.find(p => p.color === winner);
            const losingPlayer = gameState.players.find(p => p.color !== winner);
            
            if (!winningPlayer || !losingPlayer) {
                console.error('Jogador vencedor/perdedor não encontrado');
                showNotification('Erro ao processar vitória', 'error');
                isGameEnding = false;
                return;
            }
            
            // Calcular prêmio apenas se houver aposta
            let winnerPrize = 0;
            let platformFee = 0;
            
            if (betAmount > 0) {
                platformFee = calculatePlatformFee(betAmount);
                winnerPrize = (betAmount * 2) - platformFee;
                console.log(`Prêmio: ${winnerPrize}, Taxa: ${platformFee}`);
            }
            
            // Preparar atualizações em batch
            const updates = {};
            
            // Atualizar vencedor
            if (winningPlayer.uid) {
                updates[`users/${winningPlayer.uid}`] = {
                    wins: firebase.firestore.FieldValue.increment(1),
                    rating: firebase.firestore.FieldValue.increment(10)
                };
                
                if (betAmount > 0) {
                    updates[`users/${winningPlayer.uid}`].coins = 
                        firebase.firestore.FieldValue.increment(winnerPrize);
                }
            }
            
            // Atualizar perdedor
            if (losingPlayer.uid) {
                updates[`users/${losingPlayer.uid}`] = {
                    losses: firebase.firestore.FieldValue.increment(1),
                    rating: firebase.firestore.FieldValue.increment(-5)
                };
            }
            
            // Executar atualizações
            const batch = db.batch();
            
            Object.keys(updates).forEach(path => {
                const ref = db.doc(path);
                batch.update(ref, updates[path]);
            });
            
            await batch.commit();
            
            // Registrar lucro da plataforma apenas se houver aposta
            if (betAmount > 0 && platformFee > 0) {
                await db.collection('platformEarnings').add({
                    amount: platformFee,
                    betAmount: betAmount,
                    tableId: currentGameRef.id,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    winner: winningPlayer.uid,
                    winnerName: winningPlayer.displayName
                });
                
                showNotification(`Vitória! ${winningPlayer.displayName} recebeu ${winnerPrize} moedas`, 'success');
            } else {
                showNotification(`Vitória das ${winner === 'black' ? 'pretas' : 'vermelhas'}!`, 'success');
            }
        }
        
        // Atualizar estado do jogo
        const updateData = {
            status: status,
            winner: result === 'draw' ? null : result,
            finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
            resultText: result === 'draw' ? 'Empate' : `Vitória das ${result}`
        };
        
        await currentGameRef.update(updateData);
        
        console.log('Jogo finalizado com sucesso');
        
        // Voltar para o lobby após 3 segundos
        setTimeout(() => {
            leaveGame();
        }, 3000);
        
    } catch (error) {
        console.error('Erro ao finalizar jogo:', error);
        
        if (error.code === 'permission-denied') {
            showNotification('Erro de permissão ao finalizar jogo', 'error');
        } else if (error.code === 'unavailable') {
            showNotification('Sem conexão. Tente novamente.', 'error');
        } else {
            showNotification('Erro ao finalizar jogo: ' + error.message, 'error');
        }
    } finally {
        // Liberar o bloqueio após um tempo
        setTimeout(() => {
            isGameEnding = false;
        }, 5000);
    }
}

// ===== FUNÇÃO CALCULATE PLATFORM FEE =====
function calculatePlatformFee(betAmount) {
    const PLATFORM_FEES = {
        feePercentage: 0.15, // 15% de taxa da plataforma
        minFee: 1.00,        // Taxa mínima de 1 moeda
        maxFee: 50.00        // Taxa máxima de 50 moedas
    };
    
    const fee = betAmount * PLATFORM_FEES.feePercentage;
    
    // Aplicar limites
    return Math.min(
        Math.max(fee, PLATFORM_FEES.minFee),
        PLATFORM_FEES.maxFee
    );
}

// ===== FUNÇÃO AUXILIAR PARA LIMPAR DADOS UNDEFINED =====
function cleanFirestoreData(data) {
    const cleaned = {...data};
    Object.keys(cleaned).forEach(key => {
        if (cleaned[key] === undefined) {
            cleaned[key] = null;
        }
    });
    return cleaned;
}
// ===== FUNÇÃO ENDGAME SAFE COMPLETA (CORRIGIDA) =====
async function endGameSafe(result) {

     cleanupGameVoiceChat();
    // Prevenir múltiplas execuções
    if (isGameEnding) {
        console.log('endGameSafe já em execução, ignorando chamada duplicada');
        return;
    }
    
    // Verificar se o jogo já está finalizado
    if (gameState && (gameState.status === 'finished' || gameState.status === 'draw')) {
        console.log('Jogo já finalizado, ignorando chamada');
        return;
    }
    
    isGameEnding = true;
    
    try {
        if (!currentGameRef || !gameState || !gameState.players) {
            console.error('Referências inválidas em endGameSafe');
            return;
        }
        
        const betAmount = gameState.bet || 0;
        
        if (result === 'draw') {
            // Processar empate - devolver apostas
            console.log('🤝 Processando empate - devolvendo apostas');
            
            for (const player of gameState.players) {
                if (player.uid && betAmount > 0) {
                    await db.collection('users').doc(player.uid).update({
                        coins: firebase.firestore.FieldValue.increment(betAmount),
                        draws: firebase.firestore.FieldValue.increment(1),
                        rating: firebase.firestore.FieldValue.increment(2)
                    });
                    
                    // Atualizar dados locais
                    if (player.uid === currentUser.uid) {
                        userData.coins += betAmount;
                        userData.draws = (userData.draws || 0) + 1;
                        userData.rating = (userData.rating || 1000) + 2;
                    }
                }
            }
            showNotification('Empate! Apostas devolvidas.', 'info');
            
        } else {
            // Processar vitória
            console.log('🎯 Processando vitória para:', result);
            
            const winningPlayer = gameState.players.find(p => p.color === result);
            const losingPlayer = gameState.players.find(p => p.color !== result);
            
            if (!winningPlayer || !losingPlayer) {
                console.error('Jogadores não encontrados para processar vitória');
                return;
            }
            
            if (betAmount > 0) {
                // 🔥 CORREÇÃO: Cálculo correto do prêmio
                const calculation = calculatePrize(betAmount);
                
                console.log('📊 Distribuição de prêmios:');
                console.log('- Vencedor recebe:', calculation.winnerPrize, 'moedas');
                console.log('- Taxa da plataforma:', calculation.platformFee, 'moedas');
                
                // VENCEDOR: Recebe o prêmio líquido
                if (winningPlayer.uid) {
                    await db.collection('users').doc(winningPlayer.uid).update({
                        coins: firebase.firestore.FieldValue.increment(calculation.winnerPrize),
                        wins: firebase.firestore.FieldValue.increment(1),
                        rating: firebase.firestore.FieldValue.increment(10)
                    });
                    
                    // Atualizar dados locais se for o usuário atual
                    if (winningPlayer.uid === currentUser.uid) {
                        userData.coins += calculation.winnerPrize;
                        userData.wins = (userData.wins || 0) + 1;
                        userData.rating = (userData.rating || 1000) + 10;
                    }
                }
                
                // PERDEDOR: Não recebe nada (já foi debitado quando entrou na mesa)
                if (losingPlayer.uid) {
                    await db.collection('users').doc(losingPlayer.uid).update({
                        losses: firebase.firestore.FieldValue.increment(1),
                        rating: firebase.firestore.FieldValue.increment(-5)
                    });
                    
                    // Atualizar dados locais se for o usuário atual
                    if (losingPlayer.uid === currentUser.uid) {
                        userData.losses = (userData.losses || 0) + 1;
                        userData.rating = (userData.rating || 1000) - 5;
                    }
                }
                
                // Registrar lucro da plataforma
                const earningsData = cleanFirestoreData({
                    amount: calculation.platformFee,
                    betAmount: betAmount,
                    tableId: currentGameRef.id,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    players: gameState.players.map(p => p.uid),
                    winner: winningPlayer.uid,
                    winnerPrize: calculation.winnerPrize
                });
                
                await db.collection('platformEarnings').add(earningsData);
                
                showNotification(
                    `Vitória! Você recebeu ${calculation.winnerPrize} moedas (${calculation.platformFee} moedas de taxa)`, 
                    'success'
                );
                
            } else {
                // Jogo sem aposta - apenas atualizar estatísticas
                if (winningPlayer.uid) {
                    await db.collection('users').doc(winningPlayer.uid).update({
                        wins: firebase.firestore.FieldValue.increment(1),
                        rating: firebase.firestore.FieldValue.increment(10)
                    });
                }
                
                if (losingPlayer.uid) {
                    await db.collection('users').doc(losingPlayer.uid).update({
                        losses: firebase.firestore.FieldValue.increment(1),
                        rating: firebase.firestore.FieldValue.increment(-5)
                    });
                }
                
                showNotification('Vitória! +10 pontos de rating', 'success');
            }
        }
        
        // Atualizar estado da mesa
        if (currentGameRef) {
            const updateData = cleanFirestoreData({
                status: result === 'draw' ? 'draw' : 'finished',
                winner: result === 'draw' ? null : result,
                finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                resultText: result === 'draw' ? 'Empate' : `Vitória das ${result}`
            });
            
            await currentGameRef.update(updateData);
        }
        
        setTimeout(() => leaveGame(), 3000);
        
    } catch (error) {
        console.error('Erro ao finalizar jogo (safe):', error);
        showNotification('Erro ao finalizar jogo', 'error');
    } finally {
        // Liberar o bloqueio após um tempo
        setTimeout(() => {
            isGameEnding = false;
        }, 5000);
    }
}

// ===== MOSTRAR TAXAS PARA O USUÁRIO =====
function updateBetDisplay(betAmount) {
    if (betAmount > 0) {
        const calculation = calculatePrize(betAmount);
        
        const betInfo = document.getElementById('bet-info');
        if (betInfo) {
            betInfo.innerHTML = `
                <div class="bet-breakdown">
                    <strong>Detalhes da Aposta:</strong>
                    <div>Aposta: R$ ${calculation.originalBet.toFixed(2)}</div>
                    <div>Prêmio total: R$ ${calculation.totalPrize.toFixed(2)}</div>
                    <div>Taxa da plataforma (15%): R$ ${calculation.platformFee.toFixed(2)}</div>
                    <div>Ganhador recebe: R$ ${calculation.winnerPrize.toFixed(2)}</div>
                </div>
            `;
        }
    }
}

// ===== FUNÇÃO PARA VER LUCROS =====
async function viewPlatformEarnings() {
    try {
        const snapshot = await db.collection('platformEarnings')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();
        
        let totalEarnings = 0;
        let totalBets = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            totalEarnings += data.amount;
            totalBets += data.betAmount;
        });
        
        console.log(`
        📊 RELATÓRIO DE LUCROS:
        • Total arrecadado: R$ ${totalEarnings.toFixed(2)}
        • Total apostado: R$ ${totalBets.toFixed(2)}
        • Número de apostas: ${snapshot.size}
        • Média por aposta: R$ ${(totalEarnings / snapshot.size).toFixed(2)}
        `);
        
    } catch (error) {
        console.error('Erro ao carregar lucros:', error);
    }
}

// ===== CONFIGURAÇÃO DE TAXAS =====
const PLATFORM_FEES = {
    feePercentage: 0.15, // 15% de taxa da plataforma
    minFee: 1.00,        // Taxa mínima de R$ 1,00
    maxFee: 50.00        // Taxa máxima de R$ 50,00
};









// ===== FUNÇÃO CALCULAR PRÊMIO (CORRIGIDA) =====
function calculatePrize(betAmount) {
    // Em uma aposta de 100 vs 100, o pote total é 200
    const totalPot = betAmount * 2;
    
    // Taxa da plataforma (15%)
    const platformFee = totalPot * 0.15;
    
    // Prêmio líquido para o vencedor (85% do pote)
    const winnerPrize = totalPot - platformFee;
    
    console.log(`💰 Cálculo de prêmio:`);
    console.log(`• Aposta individual: ${betAmount} moedas`);
    console.log(`• Pote total: ${totalPot} moedas`);
    console.log(`• Taxa da plataforma (15%): ${platformFee} moedas`);
    console.log(`• Prêmio do vencedor: ${winnerPrize} moedas`);
    
    return {
        totalPot: totalPot,
        platformFee: platformFee,
        winnerPrize: winnerPrize,
        originalBet: betAmount
    };
}

/**
 * Processa uma aposta do jogador
 * @param {number} amount - Valor da aposta
 * @returns {boolean} True se a aposta foi bem-sucedida, False caso contrário
 */
function placeBet(amount) {
    if (amount <= 0) {
        alert("Valor de aposta inválido!");
        return false;
    }
    
    if (userBalance < amount) {
        alert("Saldo insuficiente para esta aposta!");
        return false;
    }
    
    // Debita o valor da aposta do saldo do usuário
    userBalance -= amount;
    currentBet = amount;
    currentPot = amount * 2; // Supondo que outro jogador apostará o mesmo valor
    
    updateUI();
    
    console.log(`Aposta de ${amount} moedas realizada com sucesso!`);
    console.log(`Pote atual: ${currentPot} moedas`);
    
    return true;
}

/**
 * Distribui o prêmio para o vencedor
 * @param {number} winner - Identificador do jogador vencedor
 */
function distributePrize(winner) {
    const prize = calculatePrize(currentPot);
    
    // Aqui você distribuiria o prêmio para o jogador vencedor
    // Em um sistema real, isso seria feito no backend
    
    console.log(`Jogador ${winner} venceu e recebeu ${prize} moedas!`);
    
    // Resetar apostas para uma nova partida
    currentBet = 0;
    currentPot = 0;
    
    updateUI();
}
// ===== RANKING =====
async function loadRanking() {
  try {
    const snapshot = await db.collection('users')
      .orderBy('rating', 'desc')
      .limit(20)
      .get();
    
    const rankingContainer = document.getElementById('ranking-container');
    if (rankingContainer) {
      rankingContainer.innerHTML = '';
      
      let position = 1;
      snapshot.forEach((doc) => {
        const user = { id: doc.id, ...doc.data() };
        renderRankingItem(user, position, rankingContainer);
        position++;
      });
    }
  } catch (error) {
    console.error('Erro ao carregar ranking:', error);
  }
}

// ===== FUNÇÃO GET POSSIBLE MOVES (COMPLETA E CORRIGIDA) =====
function getPossibleMoves(fromRow, fromCol) {
    if (!gameState || !gameState.board) return [];
    
    const piece = gameState.board[fromRow][fromCol];
    if (!piece) return [];
    
    console.log(`Verificando movimentos para peça em [${fromRow},${fromCol}]:`, piece);
    
    // 1. Primeiro verificar capturas obrigatórias
    let captures = [];
    
    if (piece.king) {
        // Para damas
        captures = getKingCaptureMoves(fromRow, fromCol, piece);
        console.log('Capturas de dama encontradas:', captures.length);
    } else {
        // Para peças normais
        captures = getCaptureMoves(fromRow, fromCol, piece);
        console.log('Capturas de peça normal encontradas:', captures.length);
    }
    
    // Se houver capturas, retornar apenas capturas (captura obrigatória)
    if (captures.length > 0) {
        console.log('Capturas obrigatórias encontradas:', captures.length);
        return captures;
    }
    
    // 2. Se não houver capturas, verificar movimentos normais
    if (piece.king) {
        const simpleMoves = getKingSimpleMoves(fromRow, fromCol, piece);
        console.log('Movimentos simples de dama:', simpleMoves.length);
        return simpleMoves;
    } else {
        const normalMoves = getNormalMoves(fromRow, fromCol, piece);
        console.log('Movimentos normais de peça:', normalMoves.length);
        return normalMoves;
    }
}
// ===== DEBUG DE MOVIMENTOS =====
function debugMoves(fromRow, fromCol) {
    console.log('=== DEBUG DE MOVIMENTOS ===');
    console.log('Posição:', fromRow, fromCol);
    
    const piece = gameState.board[fromRow][fromCol];
    if (!piece) {
        console.log('❌ Nenhuma peça nesta posição');
        return;
    }
    
    console.log('Peça:', piece);
    
    // Verificar capturas
    const captures = piece.king ? 
        getKingCaptureMoves(fromRow, fromCol, piece) : 
        getCaptureMoves(fromRow, fromCol, piece);
    
    console.log('Capturas encontradas:', captures.length);
    captures.forEach((capture, index) => {
        console.log(`Captura ${index + 1}:`, capture);
    });
    
    // Verificar movimentos simples
    const simpleMoves = piece.king ?
        getKingSimpleMoves(fromRow, fromCol, piece) :
        getNormalMoves(fromRow, fromCol, piece);
    
    console.log('Movimentos simples encontrados:', simpleMoves.length);
    simpleMoves.forEach((move, index) => {
        console.log(`Movimento ${index + 1}:`, move);
    });
    
    // Verificar todos os movimentos possíveis
    const allMoves = getPossibleMoves(fromRow, fromCol);
    console.log('Todos os movimentos possíveis:', allMoves.length);
}

// ===== VISUALIZAR MOVIMENTOS NO TABULEIRO =====
function visualizeMoves(fromRow, fromCol) {
    const moves = getPossibleMoves(fromRow, fromCol);
    
    console.log(`Movimentos para [${fromRow},${fromCol}]:`);
    
    moves.forEach((move, index) => {
        const moveType = move.captures.length > 0 ? 'CAPTURA' : 'MOVIMENTO';
        console.log(`${index + 1}. ${moveType}: [${move.fromRow},${move.fromCol}] -> [${move.toRow},${move.toCol}]`);
        
        if (move.captures.length > 0) {
            console.log('   Peças capturadas:', move.captures);
        }
    });
    
    return moves;
}

window.showMoves = visualizeMoves;
// Adicione ao window para testar
window.debugMoves = debugMoves;

function renderRankingItem(user, position, container) {
  const itemEl = document.createElement('div');
  itemEl.className = 'ranking-item';
  
  itemEl.innerHTML = `
    <div class="ranking-position">${position}</div>
    <div class="ranking-player">
      <div class="player-avatar">
        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=random" alt="${user.displayName}">
      </div>
      <div class="player-details">
        <div class="player-name">${user.displayName}</div>
        <div class="player-stats">Vitórias: ${user.wins || 0} | Derrotas: ${user.losses || 0}</div>
      </div>
    </div>
    <div class="ranking-score">${user.rating || 1000}</div>
  `;
  
  container.appendChild(itemEl);
}


// ===== VISUALIZAR TABULEiro PARA DEBUG =====
function visualizeBoardForDebug() {
    console.log('=== VISUALIZAÇÃO DO TABULEIRO ===');
    
    let boardStr = '  0 1 2 3 4 5 6 7\n';
    for (let row = 0; row < 8; row++) {
        let rowStr = row + ' ';
        for (let col = 0; col < 8; col++) {
            const piece = gameState.board[row][col];
            if (piece) {
                if (piece.king) {
                    rowStr += piece.color === 'black' ? 'B♔ ' : 'R♕ ';
                } else {
                    rowStr += piece.color === 'black' ? 'B○ ' : 'R○ ';
                }
            } else {
                rowStr += (row + col) % 2 === 0 ? '□ ' : '■ ';
            }
        }
        boardStr += rowStr + '\n';
    }
    
    console.log(boardStr);
}

// Adicione ao window
window.showBoard = visualizeBoardForDebug;
// ===== AMIGOS =====
async function loadFriends() {
  const friendsContainer = document.getElementById('friends-container');
  if (friendsContainer) {
    friendsContainer.innerHTML = '<p class="text-center">Funcionalidade de amigos em desenvolvimento</p>';
  }
}

// ===== FUNÇÃO CHECK GAME END CORRIGIDA =====
function checkGameEnd(board, currentTurn) {
    // Verificar se o jogo já está finalizado
    if (gameState && (gameState.status === 'finished' || gameState.status === 'draw')) {
        return;
    }
    
    // Verificar se algum jogador não tem mais peças
    let redPieces = 0;
    let blackPieces = 0;
    let redCanMove = false;
    let blackCanMove = false;
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece) {
                if (piece.color === 'red') {
                    redPieces++;
                    // Verificar se tem movimentos possíveis
                    if (getPossibleMoves(row, col).length > 0) {
                        redCanMove = true;
                    }
                } else {
                    blackPieces++;
                    // Verificar se tem movimentos possíveis
                    if (getPossibleMoves(row, col).length > 0) {
                        blackCanMove = true;
                    }
                }
            }
        }
    }
    
    // Verificar condições de vitória
    if ((redPieces === 0 || !redCanMove) && currentGameRef && !isGameEnding) {
        console.log('Jogo terminado - vitória das pretas');
        endGame('black');
    } else if ((blackPieces === 0 || !blackCanMove) && currentGameRef && !isGameEnding) {
        console.log('Jogo terminado - vitória das vermelhas');
        endGame('red');
    }
}
 // ===== SISTEMA DE CAPTURA OBRIGATÓRIA E MÚLTIPLA =====
let mandatoryCaptureState = {
    hasMandatoryCaptures: false,
    capturingPiece: null,
    availableCaptures: []
};

// ===== FUNÇÃO GET ALL POSSIBLE CAPTURES FOR COLOR (DETECÇÃO PRECISA) =====
function getAllPossibleCapturesForColor(color) {
  const allCaptures = [];
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = gameState.board[row][col];
      if (piece && piece.color === color) {
        const captures = getCaptureMoves(row, col, piece, []);
        if (captures.length > 0) {
          allCaptures.push({
            piece: { row, col },
            captures: captures
          });
        }
      }
    }
  }
  
  return allCaptures;
}

// ===== FUNÇÃO UPDATE TURN INFO (COM VERIFICAÇÕES DE SEGURANÇA) =====
function updateTurnInfo() {
    if (!gameState || !currentUser) return;
    
    const turnIndicator = document.getElementById('turn-indicator');
    const turnText = document.getElementById('turn-text');
    const turnDot = document.getElementById('turn-dot');
    
    // Verificar se os elementos existem antes de acessá-los
    if (!turnIndicator || !turnText || !turnDot) return;
    
    // Encontrar o jogador atual
    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
    
    if (!currentPlayer) {
        if (turnText) turnText.textContent = 'Aguardando...';
        if (turnIndicator) {
            turnIndicator.classList.remove('my-turn', 'opponent-turn');
        }
        return;
    }
    
    const isMyTurn = currentPlayer.color === gameState.currentTurn;
    
    if (isMyTurn) {
        // Só iniciar timer se o jogo começou
        if (hasGameStarted()) {
            startMoveTimer();
        }
        if (turnText) turnText.textContent = 'Sua vez!';
        if (turnIndicator) {
            turnIndicator.classList.add('my-turn');
            turnIndicator.classList.remove('opponent-turn');
        }
        if (turnDot) turnDot.style.backgroundColor = '#2ecc71';
    } else {
        const opponent = gameState.players.find(p => p.uid !== currentUser.uid);
        if (turnText) {
            turnText.textContent = opponent ? `Vez de ${opponent.displayName}` : 'Vez do oponente';
        }
        if (turnIndicator) {
            turnIndicator.classList.add('opponent-turn');
            turnIndicator.classList.remove('my-turn');
        }
        if (turnDot) turnDot.style.backgroundColor = '#e74c3c';
        stopMoveTimer();
    }
    
    // Atualizar também as cartas dos jogadores
    updatePlayerCards(currentPlayer, isMyTurn);
}

// ===== MAKE MOVE (CORRIGIDA PARA PROMOÇÃO) =====
async function makeMove(fromRow, fromCol, toRow, toCol, captures) {
    try {
        if (!gameState || !gameState.board || !currentGameRef) {
            showNotification('Erro: jogo não está pronto', 'error');
            return;
        }
        
        const newBoard = JSON.parse(JSON.stringify(gameState.board));
        const movingPiece = newBoard[fromRow][fromCol];
        
        // Executar movimento
        newBoard[toRow][toCol] = movingPiece;
        newBoard[fromRow][fromCol] = null;
        
        // Executar capturas (se houver)
        let capturedPieces = 0;
        if (captures && Array.isArray(captures)) {
            captures.forEach(capture => {
                if (capture && capture.row !== undefined && capture.col !== undefined) {
                    newBoard[capture.row][capture.col] = null;
                    capturedPieces++;
                }
            });
        }
        
        // 🔥 VERIFICAR PROMOÇÃO A DAMA
        let wasPromoted = false;
        if (!movingPiece.king && ((movingPiece.color === 'red' && toRow === 0) || 
            (movingPiece.color === 'black' && toRow === 7))) {
            newBoard[toRow][toCol].king = true;
            wasPromoted = true;
            console.log('🎉 Peça promovida a dama!');
            showNotification('Peça promovida a dama!', 'success');
        }
        
        // 🔥 CORREÇÃO CRÍTICA: Usar a PEÇA ATUALIZADA para verificar capturas adicionais
        const currentPiece = newBoard[toRow][toCol];
        const safeCaptures = Array.isArray(captures) ? captures : [];
        
        let shouldContinue = false;
        
        if (capturedPieces > 0) {
            if (currentPiece.king) {
                // 🔥 PARA DAMA: verificar se há mais capturas possíveis
                console.log('Verificando capturas adicionais para DAMA...');
                const moreCaptures = getKingCaptureMoves(toRow, toCol, currentPiece, safeCaptures);
                shouldContinue = moreCaptures.length > 0;
                console.log('Capturas adicionais para dama:', moreCaptures.length);
            } else {
                // 🔥 PARA PEÇA NORMAL: verificar capturas adicionais
                console.log('Verificando capturas adicionais para PEÇA NORMAL...');
                const moreCaptures = getCaptureMoves(toRow, toCol, currentPiece, safeCaptures);
                shouldContinue = moreCaptures.length > 0;
                console.log('Capturas adicionais para peça normal:', moreCaptures.length);
            }
        }
        
        if (shouldContinue) {
            console.log('↻ CONTINUAR CAPTURA MÚLTIPLA');
            
            const firestoreBoard = convertBoardToFirestoreFormat(newBoard);
            await currentGameRef.update({
                board: firestoreBoard,
                lastMove: {
                    fromRow, fromCol, toRow, toCol, captures: safeCaptures
                },
                lastMoveTime: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            gameState.board = newBoard;
            
            // Selecionar automaticamente a peça para continuar
            setTimeout(() => {
                renderBoard(newBoard);
                selectedPiece = { row: toRow, col: toCol };
                const pieceEl = document.querySelector(`.checker-piece[data-row="${toRow}"][data-col="${toCol}"]`);
                if (pieceEl) {
                    pieceEl.classList.add('selected');
                    showPossibleMoves(toRow, toCol);
                }
                showNotification('Continue capturando!', 'info');
            }, 100);
            
        } else {
            console.log('🔄 PASSAR TURNO');
            
            // PASSAR TURNO
            const firestoreBoard = convertBoardToFirestoreFormat(newBoard);
            await currentGameRef.update({
                board: firestoreBoard,
                currentTurn: gameState.currentTurn === 'red' ? 'black' : 'red',
                lastMove: {
                    fromRow, fromCol, toRow, toCol, captures: safeCaptures
                },
                lastMoveTime: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            gameState.board = newBoard;
            gameState.currentTurn = gameState.currentTurn === 'red' ? 'black' : 'red';
            
            console.log('Turno passado para:', gameState.currentTurn);
            checkGameEnd(newBoard, gameState.currentTurn);
            clearSelection();
        }
        
    } catch (error) {
        console.error('❌ Erro ao realizar movimento:', error);
        console.error('Stack:', error.stack);
        showNotification('Erro ao realizar movimento: ' + error.message, 'error');
    }
}

// ===== DEBUG DE PROMOÇÃO =====
function debugPromotion(fromRow, fromCol, toRow, toCol, captures) {
    console.log('=== DEBUG DE PROMOÇÃO ===');
    console.log('De:', fromRow, fromCol);
    console.log('Para:', toRow, toCol);
    console.log('Capturas:', captures);
    
    const movingPiece = gameState.board[fromRow][fromCol];
    console.log('Peça original:', movingPiece);
    
    // Simular promoção
    const wouldPromote = !movingPiece.king && 
        ((movingPiece.color === 'red' && toRow === 0) || 
         (movingPiece.color === 'black' && toRow === 7));
    
    console.log('Seria promovida:', wouldPromote);
    
    if (wouldPromote) {
        console.log('⚠️ ATENÇÃO: Esta jogada promove a peça a dama!');
        console.log('A verificação de capturas adicionais deve usar a NOVA dama');
    }
}

window.debugPromo = debugPromotion;

// ===== DEBUG DETALHADO DE CAPTURAS =====
function debugKingCaptures(fromRow, fromCol) {
    console.log('=== DEBUG CAPTURAS DE DAMA ===');
    console.log('Posição:', fromRow, fromCol);
    
    const piece = gameState.board[fromRow][fromCol];
    if (!piece || !piece.king) {
        console.log('❌ Não é uma dama');
        return;
    }
    
    const captures = getKingCaptureMoves(fromRow, fromCol, piece);
    console.log('Total de capturas encontradas:', captures.length);
    
    captures.forEach((capture, index) => {
        console.log(`\n--- Captura ${index + 1} ---`);
        console.log('De:', capture.fromRow, capture.fromCol);
        console.log('Para:', capture.toRow, capture.toCol);
        console.log('Peças capturadas:', capture.captures);
        console.log('Direção:', capture.direction);
        
        // Verificar se há capturas adicionais desta posição
        if (capture.captures.length > 0) {
            const additional = getKingCaptureMoves(
                capture.toRow, capture.toCol, piece, capture.captures
            );
            console.log('Capturas adicionais possíveis:', additional.length);
        }
    });
}

window.debugKingCaptures = debugKingCaptures;

// ===== TESTAR FLUXO COMPLETO =====
function testKingCaptureFlow(fromRow, fromCol, toRow, toCol) {
    console.log('=== TESTE DE FLUXO DE CAPTURA ===');
    
    const piece = gameState.board[fromRow][fromCol];
    if (!piece || !piece.king) {
        console.log('❌ Não é uma dama na posição inicial');
        return;
    }
    
    // Verificar capturas da posição inicial
    const initialCaptures = getKingCaptureMoves(fromRow, fromCol, piece);
    console.log('Capturas iniciais:', initialCaptures.length);
    
    // Encontrar a captura específica para o movimento desejado
    const targetCapture = initialCaptures.find(capture => 
        capture.toRow === toRow && capture.toCol === toCol
    );
    
    if (!targetCapture) {
        console.log('❌ Movimento não é uma captura válida');
        return;
    }
    
    console.log('Captura encontrada:', targetCapture);
    
    // Simular o movimento
    const newBoard = JSON.parse(JSON.stringify(gameState.board));
    newBoard[toRow][toCol] = piece;
    newBoard[fromRow][fromCol] = null;
    
    // Aplicar capturas
    targetCapture.captures.forEach(capture => {
        newBoard[capture.row][capture.col] = null;
    });
    
    // Verificar capturas adicionais da nova posição
    const additionalCaptures = getKingCaptureMoves(
        toRow, toCol, piece, targetCapture.captures
    );
    
    console.log('Capturas adicionais após movimento:', additionalCaptures.length);
    
    if (additionalCaptures.length > 0) {
        console.log('✅ Deve continuar capturando');
        console.log('Capturas adicionais:', additionalCaptures);
    } else {
        console.log('✅ Deve passar o turno');
    }
}

window.testFlow = testKingCaptureFlow;

// ===== FUNÇÃO GET CAPTURE MOVES PARA PEÇAS NORMAIS =====
function getCaptureMoves(fromRow, fromCol, piece, currentCaptures = []) {
    const captures = [];
    
    if (!piece || piece.king) {
        return captures; // Para damas, usar getKingCaptureMoves
    }
    
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    for (const [rowDir, colDir] of directions) {
        const jumpRow = fromRow + rowDir;
        const jumpCol = fromCol + colDir;
        const landRow = fromRow + 2 * rowDir;
        const landCol = fromCol + 2 * colDir;
        
        // Verificar se está dentro do tabuleiro
        if (landRow < 0 || landRow > 7 || landCol < 0 || landCol > 7) {
            continue;
        }
        
        const jumpedPiece = gameState.board[jumpRow][jumpCol];
        const landingCell = gameState.board[landRow][landCol];
        
        // Verificar se já foi capturada
        const alreadyCaptured = currentCaptures.some(c => 
            c.row === jumpRow && c.col === jumpCol
        );
        
        // Verificar se é uma captura válida
        if (!alreadyCaptured && 
            jumpedPiece && 
            jumpedPiece.color !== piece.color && 
            landingCell === null) {
            
            const newCapture = { row: jumpRow, col: jumpCol };
            const allCaptures = [...currentCaptures, newCapture];
            
            const captureMove = {
                fromRow,
                fromCol,
                toRow: landRow,
                toCol: landCol,
                captures: allCaptures
            };
            
            captures.push(captureMove);
            
            // Verificar capturas adicionais a partir da nova posição
            const furtherCaptures = getCaptureMoves(
                landRow, landCol, piece, allCaptures
            );
            
            captures.push(...furtherCaptures);
        }
    }
    
    return captures;
}
// ===== FUNÇÃO GET CAPTURE MOVES FROM BOARD (ATUALIZADA PARA DAMAS) =====
function getCaptureMovesFromBoard(fromRow, fromCol, piece, currentCaptures, virtualBoard) {
    const captures = [];
    
    if (piece.king) {
        // Capturas para damas
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        
        for (const [rowDir, colDir] of directions) {
            let foundCapture = false;
            let capturePosition = null;
            
            for (let distance = 1; distance <= 7; distance++) {
                const checkRow = fromRow + (rowDir * distance);
                const checkCol = fromCol + (colDir * distance);
                
                if (checkRow < 0 || checkRow > 7 || checkCol < 0 || checkCol > 7) break;
                
                const checkCell = virtualBoard[checkRow][checkCol];
                
                if (!foundCapture) {
                    if (checkCell) {
                        if (checkCell.color !== piece.color) {
                            foundCapture = true;
                            capturePosition = { row: checkRow, col: checkCol };
                            
                            const alreadyCaptured = currentCaptures.some(c => 
                                c.row === checkRow && c.col === checkCol
                            );
                            
                            if (alreadyCaptured) {
                                foundCapture = false;
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                } else {
                    if (checkCell === null) {
                        const newCapture = { row: capturePosition.row, col: capturePosition.col };
                        const allCaptures = [...currentCaptures, newCapture];
                        
                        const captureMove = {
                            fromRow,
                            fromCol,
                            toRow: checkRow,
                            toCol: checkCol,
                            captures: allCaptures
                        };
                        
                        captures.push(captureMove);
                        
                        // Continuar verificando
                        const newVirtualBoard = JSON.parse(JSON.stringify(virtualBoard));
                        newVirtualBoard[checkRow][checkCol] = piece;
                        newVirtualBoard[fromRow][fromCol] = null;
                        newVirtualBoard[capturePosition.row][capturePosition.col] = null;
                        
                        const furtherCaptures = getCaptureMovesFromBoard(checkRow, checkCol, piece, allCaptures, newVirtualBoard);
                        captures.push(...furtherCaptures);
                    } else {
                        break;
                    }
                }
            }
        }
    } else {
        // Capturas para peças normais
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        
        for (const [rowDir, colDir] of directions) {
            const jumpRow = fromRow + rowDir;
            const jumpCol = fromCol + colDir;
            const landRow = fromRow + 2 * rowDir;
            const landCol = fromCol + 2 * colDir;
            
            if (landRow < 0 || landRow > 7 || landCol < 0 || landCol > 7) continue;
            
            const jumpedPiece = virtualBoard[jumpRow][jumpCol];
            const landingCell = virtualBoard[landRow][landCol];
            
            const alreadyCaptured = currentCaptures.some(c => 
                c.row === jumpRow && c.col === jumpCol
            );
            
            if (!alreadyCaptured && 
                jumpedPiece && 
                jumpedPiece.color !== piece.color && 
                landingCell === null) {
                
                const newCapture = { row: jumpRow, col: jumpCol };
                const allCaptures = [...currentCaptures, newCapture];
                
                const captureMove = {
                    fromRow,
                    fromCol,
                    toRow: landRow,
                    toCol: landCol,
                    captures: allCaptures
                };
                
                captures.push(captureMove);
                
                const newVirtualBoard = JSON.parse(JSON.stringify(virtualBoard));
                newVirtualBoard[landRow][landCol] = piece;
                newVirtualBoard[fromRow][fromCol] = null;
                newVirtualBoard[jumpRow][jumpCol] = null;
                
                const furtherCaptures = getCaptureMovesFromBoard(landRow, landCol, piece, allCaptures, newVirtualBoard);
                captures.push(...furtherCaptures);
            }
        }
    }
    
    return captures;
}


// ===== FUNÇÃO GET KING CAPTURE MOVES (MAIS ROBUSTA) =====
function getKingCaptureMoves(fromRow, fromCol, piece, currentCaptures = []) {
    console.log('getKingCaptureMoves chamada com:', {fromRow, fromCol, piece, currentCaptures});
    
    // 🔥 VERIFICAÇÕES DE SEGURANça EXTRA
    if (!piece || typeof piece !== 'object') {
        console.error('❌ Peça inválida:', piece);
        return [];
    }
    
    if (!piece.king) {
        console.log('⚠️ AVISO: Função de dama chamada para peça normal');
        return [];
    }
    
    const safeCurrentCaptures = Array.isArray(currentCaptures) ? currentCaptures : [];
    
    const captures = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    for (const [rowDir, colDir] of directions) {
        try {
            const directionCaptures = getKingCapturesInDirection(
                fromRow, fromCol, rowDir, colDir, piece, safeCurrentCaptures, []
            );
            captures.push(...directionCaptures);
        } catch (error) {
            console.error('❌ Erro na direção', [rowDir, colDir], error);
        }
    }
    
    console.log('getKingCaptureMoves retornando:', captures.length, 'capturas');
    return captures;
}
// ===== FUNÇÃO GET NORMAL PIECE CAPTURE MOVES (DEBUG) =====
function getNormalPieceCaptureMoves(fromRow, fromCol, piece, currentCaptures = []) {
    const captures = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    for (const [rowDir, colDir] of directions) {
        const jumpRow = fromRow + rowDir;
        const jumpCol = fromCol + colDir;
        const landRow = fromRow + 2 * rowDir;
        const landCol = fromCol + 2 * colDir;
        
        if (landRow < 0 || landRow > 7 || landCol < 0 || landCol > 7) continue;
        
        const jumpedPiece = gameState.board[jumpRow][jumpCol];
        const landingCell = gameState.board[landRow][landCol];
        
        const alreadyCaptured = currentCaptures.some(c => 
            c.row === jumpRow && c.col === jumpCol
        );
        
        console.log('Direção:', rowDir, colDir);
        console.log('Pular peça em:', jumpRow, jumpCol, jumpedPiece);
        console.log('Pousar em:', landRow, landCol, landingCell);
        console.log('Já capturada:', alreadyCaptured);
        
        if (!alreadyCaptured && 
            jumpedPiece && 
            jumpedPiece.color !== piece.color && 
            landingCell === null) {
            
            console.log('CAPTURA VÁLIDA ENCONTRADA');
            const newCapture = { row: jumpRow, col: jumpCol };
            const allCaptures = [...currentCaptures, newCapture];
            
            const captureMove = {
                fromRow,
                fromCol,
                toRow: landRow,
                toCol: landCol,
                captures: allCaptures
            };
            
            captures.push(captureMove);
        }
    }
    
    return captures;
}


// ===== DEBUG: VERIFICAR MOVIMENTOS DE DAMA =====
function debugKingMoves(fromRow, fromCol) {
    console.log('=== DEBUG MOVIMENTOS DE DAMA ===');
    console.log('Posição:', fromRow, fromCol);
    
    const piece = gameState.board[fromRow][fromCol];
    if (!piece) {
        console.log('❌ Nenhuma peça nesta posição');
        return;
    }
    
    console.log('Peça:', piece);
    
    // Verificar capturas
    const captures = getKingCaptureMoves(fromRow, fromCol, piece);
    console.log('Capturas encontradas:', captures.length);
    
    captures.forEach((capture, index) => {
        console.log(`Captura ${index + 1}:`);
        console.log('  De:', capture.fromRow, capture.fromCol);
        console.log('  Para:', capture.toRow, capture.toCol);
        console.log('  Peças capturadas:', capture.captures);
        console.log('  Direção:', capture.direction);
    });
    
    // Verificar movimentos simples também
    const simpleMoves = getKingSimpleMoves(fromRow, fromCol, piece);
    console.log('Movimentos simples:', simpleMoves.length);
}

// ===== FUNÇÃO GET KING SIMPLE MOVES =====
function getKingSimpleMoves(fromRow, fromCol, piece) {
    const moves = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    for (const [rowDir, colDir] of directions) {
        for (let distance = 1; distance <= 7; distance++) {
            const toRow = fromRow + (rowDir * distance);
            const toCol = fromCol + (colDir * distance);
            
            if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) {
                break;
            }
            
            const cell = gameState.board[toRow][toCol];
            
            if (cell === null) {
                // Casa vazia - movimento válido
                moves.push({
                    fromRow,
                    fromCol,
                    toRow,
                    toCol,
                    captures: []
                });
            } else {
                // Casa ocupada - não pode mover além
                break;
            }
        }
    }
    
    return moves;
}

// Adicione ao window para testar
window.debugKing = debugKingMoves;
// ===== FUNÇÃO GET KING CAPTURE MOVES (CORRIGIDA) =====
function getKingCaptureMoves(fromRow, fromCol, piece, currentCaptures = []) {
    const captures = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    for (const [rowDir, colDir] of directions) {
        // Verificar capturas nesta direção
        const directionCaptures = getKingCapturesInDirection(
            fromRow, fromCol, rowDir, colDir, piece, currentCaptures
        );
        
        captures.push(...directionCaptures);
    }
    
    return captures;
}
// ===== VERIFICAR CAPTURAS EM UMA DIREÇÃO (CORRIGIDA) =====
function getKingCapturesInDirection(fromRow, fromCol, rowDir, colDir, piece, currentCaptures = [], currentPath = []) {
    const captures = [];
    
    // 🔥 GARANTIR que os parâmetros são arrays válidos
    const safeCurrentCaptures = Array.isArray(currentCaptures) ? currentCaptures : [];
    const safeCurrentPath = Array.isArray(currentPath) ? currentPath : [];
    
    let foundEnemy = false;
    let enemyPosition = null;
    
    // Evitar loops infinitos - verificar se já passou por esta posição
    if (safeCurrentPath.some(pos => pos.row === fromRow && pos.col === fromCol)) {
        return captures;
    }
    
    // Adicionar posição atual ao caminho
    const newPath = [...safeCurrentPath, { row: fromRow, col: fromCol }];
    
    // Procurar na direção especificada
    for (let distance = 1; distance <= 7; distance++) {
        const checkRow = fromRow + (rowDir * distance);
        const checkCol = fromCol + (colDir * distance);
        
        if (checkRow < 0 || checkRow > 7 || checkCol < 0 || checkCol > 7) break;
        
        const checkCell = gameState.board[checkRow][checkCol];
        
        if (!foundEnemy) {
            // Procurando por peça inimiga
            if (checkCell) {
                if (checkCell.color !== piece.color) {
                    // Verificar se esta peça já foi capturada
                    const alreadyCaptured = safeCurrentCaptures.some(c => 
                        c && c.row === checkRow && c.col === checkCol
                    );
                    
                    if (!alreadyCaptured) {
                        foundEnemy = true;
                        enemyPosition = { row: checkRow, col: checkCol };
                    } else {
                        // Peça já capturada, continuar procurando
                        continue;
                    }
                } else {
                    // Peça aliada - não pode pular
                    break;
                }
            }
        } else {
            // Já encontrou inimigo, procurar casa vazia
            if (checkCell === null) {
                // Captura válida encontrada
                const newCapture = { 
                    row: enemyPosition.row, 
                    col: enemyPosition.col 
                };
                const allCaptures = [...safeCurrentCaptures, newCapture];
                
                const captureMove = {
                    fromRow,
                    fromCol,
                    toRow: checkRow,
                    toCol: checkCol,
                    captures: allCaptures,
                    direction: [rowDir, colDir]
                };
                
                captures.push(captureMove);
                
                // Verificar capturas adicionais a partir da NOVA posição
                const furtherCaptures = getKingAdditionalCaptures(
                    checkRow, checkCol, piece, allCaptures, newPath
                );
                
                captures.push(...furtherCaptures);
                
            } else if (checkCell) {
                // Casa ocupada - não pode pular além
                break;
            }
        }
    }
    
    return captures;
}
// ===== CAPTURAS ADICIONAIS (CORRIGIDA) =====
function getKingAdditionalCaptures(fromRow, fromCol, piece, currentCaptures = [], currentPath = []) {
    const additionalCaptures = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    // 🔥 GARANTIR que os parâmetros são arrays válidos
    const safeCurrentCaptures = Array.isArray(currentCaptures) ? currentCaptures : [];
    const safeCurrentPath = Array.isArray(currentPath) ? currentPath : [];
    
    for (const [rowDir, colDir] of directions) {
        const directionCaptures = getKingCapturesInDirection(
            fromRow, fromCol, rowDir, colDir, piece, safeCurrentCaptures, safeCurrentPath
        );
        additionalCaptures.push(...directionCaptures);
    }
    
    return additionalCaptures;
}


function renderBoard(boardState) {

      try {
        
    const board = document.getElementById('checkers-board');
    if (!board) {
        console.error('Elemento checkers-board não existe no DOM!');
        return;
    }
    
    if (!boardState) {
        console.error('boardState é null ou undefined');
        return;
    }
    
    // Prevenir renderizações muito frequentes
    const now = Date.now();
    if (now - lastRenderTime < 300) { // Limitar a ~3 renderizações por segundo
        return;
    }
    lastRenderTime = now;
    
    // Verificar se o board realmente mudou
    const currentBoardHash = JSON.stringify(boardState);
    if (currentBoardHash === lastRenderedBoardHash && board.children.length > 0) {
        // Apenas atualizar as peças existentes se necessário
        updateExistingPieces(boardState);
        return;
    }
    lastRenderedBoardHash = currentBoardHash;
    
    // Limpar o board apenas se necessário
    if (board.children.length > 0) {
        board.innerHTML = '';
    }
    
    if (!gameState || !gameState.players) return;
    
    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
    const isMyTurn = currentPlayer && currentPlayer.color === gameState.currentTurn;
    
    // Verificar capturas obrigatórias apenas se for a vez do jogador
    let hasMandatoryCaptures = false;
    if (isMyTurn) {
        hasMandatoryCaptures = checkGlobalMandatoryCaptures();
    }
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.className = `board-cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            if ((row + col) % 2 !== 0) {
                cell.addEventListener('click', () => handleCellClick(row, col));
            }
            
            const piece = boardState[row][col];
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.className = `checker-piece ${piece.color} ${piece.king ? 'king' : ''}`;
                pieceEl.dataset.row = row;
                pieceEl.dataset.col = col;
                
                // Adicionar indicador de torcida
                const supportersCount = currentSpectators.filter(s => s.supporting === piece.color).length;
                if (supportersCount > 2) {
                    pieceEl.innerHTML = `<span class="supporters-indicator">${supportersCount}👏</span>`;
                }
                
                let canSelect = isMyTurn && piece.color === currentPlayer.color;
                
                if (canSelect && hasMandatoryCaptures) {
                    const canThisPieceCapture = capturingPieces.some(p => p.row === row && p.col === col);
                    canSelect = canThisPieceCapture;
                    
                    if (!canSelect) {
                        pieceEl.classList.add('disabled-piece');
                        pieceEl.style.opacity = '0.4';
                        pieceEl.title = 'Selecione uma peça que possa capturar';
                    }
                }
                
                if (canSelect) {
                    pieceEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        handlePieceClick(row, col);
                    });
                    pieceEl.style.cursor = 'pointer';
                    pieceEl.title = 'Clique para selecionar';
                } else {
                    pieceEl.style.cursor = 'not-allowed';
                    pieceEl.style.opacity = '0.6';
                }
                
                cell.appendChild(pieceEl);
            }
            
            board.appendChild(cell);
        }
    }
    
    if (hasMandatoryCaptures) {
        highlightCapturingPieces();
        showNotification('Captura obrigatória!', 'warning');
    }
    
    updateTurnInfo();
    renderDrawOfferIndicator();
    enhanceMobileExperience();
     } catch (error) {
        console.error('Erro em renderBoard:', error);
    }
}

// ===== ATUALIZAR PEÇAS EXISTENTES =====
function updateExistingPieces(boardState) {
    let needsUpdate = false;
    
    document.querySelectorAll('.checker-piece').forEach(pieceEl => {
        const row = parseInt(pieceEl.dataset.row);
        const col = parseInt(pieceEl.dataset.col);
        const piece = boardState[row][col];
        
        if (!piece) {
            pieceEl.remove();
            needsUpdate = true;
            return;
        }
        
        // Verificar se a peça mudou
        const currentClass = `checker-piece ${piece.color} ${piece.king ? 'king' : ''}`;
        if (pieceEl.className !== currentClass) {
            pieceEl.className = currentClass;
            needsUpdate = true;
        }
        
        // Atualizar interatividade
        const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
        const isMyTurn = currentPlayer && currentPlayer.color === gameState.currentTurn;
        let canSelect = isMyTurn && piece.color === currentPlayer.color;
        
        if (canSelect && hasGlobalMandatoryCaptures) {
            const canThisPieceCapture = capturingPieces.some(p => p.row === row && p.col === col);
            canSelect = canThisPieceCapture;
        }
        
        const shouldBeClickable = canSelect ? 'pointer' : 'not-allowed';
        const shouldBeOpaque = canSelect ? '1' : '0.6';
        
        if (pieceEl.style.cursor !== shouldBeClickable || pieceEl.style.opacity !== shouldBeOpaque) {
            pieceEl.style.cursor = shouldBeClickable;
            pieceEl.style.opacity = shouldBeOpaque;
            needsUpdate = true;
        }
    });
    
    return needsUpdate;
}

// ===== MELHORAR EXPERIÊNCIA MOBILE =====
function enhanceMobileExperience() {
    // Aumentar área de toque para peças em dispositivos móveis
    if ('ontouchstart' in window) {
        document.querySelectorAll('.checker-piece').forEach(piece => {
            piece.style.minWidth = '44px';
            piece.style.minHeight = '44px';
            piece.style.margin = '-8px';
        });
        
        // Adicionar feedback visual para toque
        document.addEventListener('touchstart', function(e) {
            if (e.target.classList.contains('checker-piece')) {
                e.target.classList.add('touch-active');
            }
        });
        
        document.addEventListener('touchend', function(e) {
            document.querySelectorAll('.checker-piece.touch-active').forEach(piece => {
                piece.classList.remove('touch-active');
            });
        });
    }
}






// ===== FUNÇÃO COUNT PIECES =====
function countPieces(color) {
    if (!gameState || !gameState.board) return 0;
    
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameState.board[row][col];
            if (piece && piece.color === color) {
                count++;
            }
        }
    }
    return count;
}

// ===== ATUALIZAR CONTAGEM DE PEÇAS =====
function updatePiecesCount() {
    if (!gameState) return;
    
    const blackPieces = countPieces('black');
    const redPieces = countPieces('red');
    
    // Atualizar contagem nas cartas dos jogadores
    document.querySelectorAll('.player-stats .pieces').forEach(el => {
        const playerCard = el.closest('.player-card');
        if (playerCard.classList.contains('opponent')) {
            el.textContent = `${redPieces} peça${redPieces !== 1 ? 's' : ''}`;
        } else {
            el.textContent = `${blackPieces} peça${blackPieces !== 1 ? 's' : ''}`;
        }
    });
}
// ===== LIMPAR PROPOSTA DE EMPATE =====
function cleanupDrawOffer() {
    const indicator = document.getElementById('draw-offer-indicator');
    if (indicator) {
        indicator.remove();
    }
}


// ===== FUNÇÃO GET NORMAL MOVES (ATUALIZADA PARA DAMAS) =====
function getNormalMoves(fromRow, fromCol, piece) {
    const moves = [];
    
    if (piece.king) {
        // DAMA: pode mover em todas as direções até encontrar uma peça
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        
        for (const [rowDir, colDir] of directions) {
            for (let distance = 1; distance <= 7; distance++) {
                const toRow = fromRow + (rowDir * distance);
                const toCol = fromCol + (colDir * distance);
                
                if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) break;
                if ((toRow + toCol) % 2 === 0) continue; // Apenas casas escuras
                
                if (gameState.board[toRow][toCol] === null) {
                    moves.push({
                        fromRow,
                        fromCol,
                        toRow,
                        toCol,
                        captures: []
                    });
                } else {
                    // Casa ocupada - não pode mover além
                    break;
                }
            }
        }
    } else {
        // PEÇA NORMAL: move apenas uma casa para frente
        const direction = piece.color === 'red' ? -1 : 1;
        const directions = [[direction, -1], [direction, 1]];
        
        for (const [rowDir, colDir] of directions) {
            const toRow = fromRow + rowDir;
            const toCol = fromCol + colDir;
            
            if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) continue;
            if ((toRow + toCol) % 2 === 0) continue;
            
            if (gameState.board[toRow][toCol] === null) {
                moves.push({
                    fromRow,
                    fromCol,
                    toRow,
                    toCol,
                    captures: []
                });
            }
        }
    }
    
    return moves;
}
// ===== CHECK GLOBAL MANDATORY CAPTURES (CORRIGIDA) =====
function checkGlobalMandatoryCaptures() {
    // ✅ INICIALIZAÇÃO SEGURA: Garantir que as variáveis existam
    if (typeof lastCaptureCheckTime === 'undefined') {
        lastCaptureCheckTime = 0;
    }
    if (typeof lastBoardStateHash === 'undefined') {
        lastBoardStateHash = '';
    }
    if (typeof hasGlobalMandatoryCaptures === 'undefined') {
        hasGlobalMandatoryCaptures = false;
    }
    if (typeof capturingPieces === 'undefined') {
        capturingPieces = [];
    }
    
    // Prevenir checks muito frequentes
    const now = Date.now();
    if (now - lastCaptureCheckTime < 500) { // Só verificar a cada 500ms
        return hasGlobalMandatoryCaptures;
    }
    lastCaptureCheckTime = now;
    
    if (!gameState || !gameState.board || !gameState.players) {
        hasGlobalMandatoryCaptures = false;
        capturingPieces = [];
        return false;
    }
    
    // Calcular hash do estado atual do tabuleiro para evitar recálculos desnecessários
    const currentBoardHash = JSON.stringify(gameState.board);
    if (currentBoardHash === lastBoardStateHash && hasGlobalMandatoryCaptures !== undefined) {
        return hasGlobalMandatoryCaptures;
    }
    lastBoardStateHash = currentBoardHash;
    
    const currentColor = gameState.currentTurn;
    capturingPieces = [];
    hasGlobalMandatoryCaptures = false;
    
    // Verificar todas as peças da cor atual
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameState.board[row][col];
            if (piece && piece.color === currentColor) {
                const captures = getCaptureMoves(row, col, piece, []);
                if (captures.length > 0) {
                    capturingPieces.push({ 
                        row, 
                        col, 
                        captureCount: captures[0].captures.length 
                    });
                    hasGlobalMandatoryCaptures = true;
                }
            }
        }
    }
    
    // Ordenar por peças com mais capturas possíveis
    capturingPieces.sort((a, b) => b.captureCount - a.captureCount);
    
    return hasGlobalMandatoryCaptures;
}
// ===== FUNÇÃO GET NORMAL MOVES PARA PEÇAS NORMAIS =====
function getNormalMoves(fromRow, fromCol, piece) {
    const moves = [];
    
    if (!piece || piece.king) {
        return moves; // Para damas, usar getKingSimpleMoves
    }
    
    const direction = piece.color === 'red' ? -1 : 1;
    const directions = [[direction, -1], [direction, 1]];
    
    for (const [rowDir, colDir] of directions) {
        const toRow = fromRow + rowDir;
        const toCol = fromCol + colDir;
        
        if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) {
            continue;
        }
        
        if (gameState.board[toRow][toCol] === null) {
            moves.push({
                fromRow,
                fromCol,
                toRow,
                toCol,
                captures: []
            });
        }
    }
    
    return moves;
}

// ===== INICIALIZAÇÃO E VERIFICAÇÃO DE CAPTURAS =====
function checkForMandatoryCaptures() {
    const currentPlayerColor = gameState.currentTurn;
    const captures = getAllPossibleCapturesForColor(currentPlayerColor);
    
    if (captures.length > 0) {
        showNotification('Captura obrigatória! Você deve capturar.', 'warning');
        return true;
    }
    
    return false;
}



// ===== DEBUG: VERIFICAR ESTRUTURA DO TABULEIRO =====
function debugBoardStructure(board) {
  console.log('Estrutura do tabuleiro:');
  console.log('Tipo:', typeof board);
  
  if (Array.isArray(board)) {
    console.log('É um array, comprimento:', board.length);
    if (board.length > 0) {
      console.log('Primeira linha é array?', Array.isArray(board[0]));
    }
  } else if (typeof board === 'object') {
    console.log('É um objeto, chaves:', Object.keys(board));
  }
  
  console.log('Conteúdo completo:', board);
}
// ===== JOGO DE DAMAS =====
function initializeGame() {
  renderEmptyBoard();
}

function renderEmptyBoard() {
  const board = document.getElementById('checkers-board');
  if (board) {
    board.innerHTML = '';
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const cell = document.createElement('div');
        cell.className = `board-cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
        cell.dataset.row = row;
        cell.dataset.col = col;
        
        if ((row + col) % 2 !== 0) {
          cell.addEventListener('click', () => handleCellClick(row, col));
        }
        
        board.appendChild(cell);
      }
    }
  }
}

// ... (o restante das funções do jogo permanecem iguais)

// ===== RECUPERAÇÃO DE SENHA =====
function showPasswordRecovery() {
  const email = document.getElementById('email').value;
  const authContainer = document.querySelector('.auth-container');
  
  if (authContainer) {
    authContainer.innerHTML = `
      <div class="auth-form">
        <h3>Recuperar Senha</h3>
        <p>Informe seu e-mail para receber instruções de recuperação de senha.</p>
        
        <div class="input-group">
          <i class="fas fa-envelope"></i>
          <input type="email" id="recovery-email" placeholder="Seu e-mail" value="${email || ''}">
        </div>
        
        <button id="btn-recover" class="btn btn-primary">Enviar Instruções</button>
        
        <div class="auth-options">
          <a href="#" id="recovery-back">Voltar ao login</a>
        </div>
      </div>
    `;
    
    // Adicionar eventos
    document.getElementById('btn-recover').addEventListener('click', sendPasswordRecovery);
    document.getElementById('recovery-back').addEventListener('click', (e) => {
      e.preventDefault();
      location.reload();
    });
  }
}

async function sendPasswordRecovery() {
  const email = document.getElementById('recovery-email').value.trim();
  
  if (!validateEmail(email)) {
    showNotification('Por favor, insira um e-mail válido', 'error');
    return;
  }
  
  try {
    showLoading(true);
    await auth.sendPasswordResetEmail(email);
    showNotification('E-mail de recuperação enviado! Verifique sua caixa de entrada.', 'success');
    
    setTimeout(() => {
      location.reload();
    }, 3000);
    
  } catch (error) {
    showNotification('Erro ao enviar e-mail de recuperação: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ===== CONTA DE TESTE =====
async function signInWithTestAccount() {
  try {
    showLoading(true);
    await auth.signInWithEmailAndPassword('teste@exemplo.com', 'senhateste');
    showNotification('Login com conta de teste realizado!', 'success');
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      try {
        const userCredential = await auth.createUserWithEmailAndPassword('teste@exemplo.com', 'senhateste');
        
        await db.collection('users').doc(userCredential.user.uid).set({
          displayName: 'JogadorTeste',
          email: 'teste@exemplo.com',
          coins: 500,
          wins: 10,
          losses: 5,
          draws: 2,
          rating: 1200,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification('Conta de teste criada e login realizado!', 'success');
      } catch (createError) {
        showNotification('Erro ao criar conta de teste: ' + createError.message, 'error');
      }
    } else {
      showNotification('Erro ao fazer login com conta de teste: ' + error.message, 'error');
    }
  } finally {
    showLoading(false);
  }
}
// ===== FUNÇÃO initializeBrazilianCheckersBoard (CORREÇÃO DEFINITIVA) =====
function initializeBrazilianCheckersBoard() {
  console.log('=== INICIALIZANDO TABULEIRO CORRETAMENTE ===');
  const board = Array(8).fill().map(() => Array(8).fill(null));
  
  // PEÇAS PRETAS (black) - TOPO (linhas 0,1,2)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 !== 0) { // Apenas casas escuras
        board[row][col] = { color: 'black', king: false };
        console.log(`Peça PRETA colocada em: ${row},${col}`);
      }
    }
  }
  
  // PEÇAS VERMELHAS (red) - BASE (linhas 5,6,7)
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 !== 0) { // Apenas casas escuras
        board[row][col] = { color: 'red', king: false };
        console.log(`Peça VERMELHA colocada em: ${row},${col}`);
      }
    }
  }
  
  // DEBUG: Mostrar tabuleiro
  console.log('=== TABULEIRO FINAL ===');
  for (let row = 0; row < 8; row++) {
    let rowStr = `${row}: `;
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        rowStr += piece.color === 'black' ? 'B ' : 'R ';
      } else {
        rowStr += (row + col) % 2 !== 0 ? '_ ' : 'X ';
      }
    }
    console.log(rowStr);
  }
  
  return board;
}


// ===== FUNÇÃO PARA VERIFICAR ELEMENTOS =====
function checkRequiredElements() {
  const requiredElements = [
    'btn-login', 'btn-register', 'btn-google', 'btn-logout',
    'login-form', 'register-form', 'show-register', 'show-login',
    'btn-register-submit'
  ];
  
  console.log('Verificando elementos necessários:');
  
  requiredElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      console.log(`✓ Elemento #${id} encontrado`);
    } else {
      console.error(`✗ Elemento #${id} NÃO encontrado`);
    }
  });
}



// ===== DELEGAÇÃO DE EVENTOS (fallback) =====
document.addEventListener('click', function(e) {
  // Verificar se o clique foi em um link com texto "Criar uma conta"
  if (e.target.tagName === 'A' && e.target.textContent.includes('Criar uma conta')) {
    console.log('Clique em link "Criar uma conta" detectado via delegation');
    e.preventDefault();
    showRegisterForm();
    return;
  }
  
  // Verificar se o clique foi em um elemento com ID show-register
  if (e.target.id === 'show-register') {
    console.log('Clique em elemento com ID show-register detectado via delegation');
    e.preventDefault();
    showRegisterForm();
    return;
  }
  
  // Verificar se o clique foi em um filho de elemento com ID show-register
  if (e.target.closest('#show-register')) {
    console.log('Clique em filho de elemento com ID show-register detectado via delegation');
    e.preventDefault();
    showRegisterForm();
  }
});

// ===== FUNÇÃO DE INICIALIZAÇÃO DO TURNO =====
function initializeTurn() {
  // Verificar capturas obrigatórias no início de cada turno
  const hasMandatoryCaptures = getAllPossibleCapturesForColor(gameState.currentTurn).length > 0;
  
  if (hasMandatoryCaptures) {
    showNotification('Captura obrigatória! Você deve capturar.', 'warning');
    
    // Encontrar todas as peças que podem capturar
    const capturingPieces = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col];
        if (piece && piece.color === gameState.currentTurn) {
          const captures = getCaptureMoves(row, col, piece, []);
          if (captures.length > 0) {
            capturingPieces.push({ row, col });
          }
        }
      }
    }
    
    console.log('Peças que podem capturar:', capturingPieces);
  }
}



// ===== VARIÁVEIS GLOBAIS PARA CHAT =====
let chatListener = null;

// ===== INICIALIZAÇÃO DO CHAT =====
function initializeChat() {
    const chatInput = document.querySelector('.chat-input input');
    const chatSendBtn = document.querySelector('.chat-input .btn');
    
    if (chatInput && chatSendBtn) {
        chatSendBtn.addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
}

// ===== FUNÇÃO SEND CHAT MESSAGE =====
async function sendChatMessage() {
    if (!currentGameRef || !currentUser || !userData) return;
    
    const chatInput = document.querySelector('.chat-input input');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    try {
        await db.collection('tables').doc(currentGameRef.id).collection('chat').add({
            message: message,
            senderId: currentUser.uid,
            senderName: userData.displayName,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            color: gameState.players.find(p => p.uid === currentUser.uid)?.color || 'black'
        });
        
        chatInput.value = '';
        
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        showNotification('Erro ao enviar mensagem', 'error');
    }
}

// ===== FUNÇÃO SETUP CHAT LISTENER =====
function setupChatListener() {
    // Remover listener anterior se existir
    if (chatListener) chatListener();
    
    if (!currentGameRef) return;
    
    chatListener = db.collection('tables')
        .doc(currentGameRef.id)
        .collection('chat')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            const chatMessages = document.getElementById('chat-messages');
            if (!chatMessages) return;
            
            // Limpar apenas se for uma nova snapshot
            chatMessages.innerHTML = '';
            
            snapshot.forEach((doc) => {
                const message = doc.data();
                renderChatMessage(message, chatMessages);
            });
            
            // Rolar para a última mensagem
            scrollChatToBottom();
        }, (error) => {
            console.error('Erro no chat:', error);
        });
}

// ===== FUNÇÃO RENDER CHAT MESSAGE =====
function renderChatMessage(message, container) {
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${message.senderId === currentUser.uid ? 'own-message' : 'other-message'}`;
    
    const time = message.timestamp ? new Date(message.timestamp.toDate()).toLocaleTimeString() : 'Agora';
    
    messageEl.innerHTML = `
        <div class="message-content">
            <div class="message-sender">${message.senderName}</div>
            <div class="message-text">${escapeHtml(message.message)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    // Adicionar cor baseada no jogador
    if (message.color) {
        messageEl.style.borderLeft = `3px solid ${message.color === 'black' ? '#000' : '#e74c3c'}`;
    }
    
    container.appendChild(messageEl);
}

// ===== FUNÇÃO SCROLL CHAT TO BOTTOM =====
function scrollChatToBottom() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// ===== FUNÇÃO ESCAPE HTML (SEGURANÇA) =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== FUNÇÃO CLEANUP CHAT =====
function cleanupChat() {
    if (chatListener) {
        chatListener();
        chatListener = null;
    }
    
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
}




// ===== INICIALIZAÇÃO DO MODAL DE ESPECTADORES (CORRIGIDA) =====
function initializeSpectatorsModal() {
    console.log('Initializando modal de espectadores...');
    
    // Verificar se o botão existe antes de adicionar event listeners
    const spectatorsBtn = document.getElementById('btn-spectators');
    if (!spectatorsBtn) {
        console.error('Botão de espectadores não encontrado (#btn-spectators)');
        return;
    }
    
    // Criar modal se não existir
    if (!document.getElementById('spectators-modal')) {
        const modalHTML = `
            <div class="modal spectators-modal" id="spectators-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>👥 Espectadores e Torcedores</h3>
                        <button class="modal-close" id="close-spectators">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="spectators-stats">
                            <div class="stat-item">
                                <i class="fas fa-eye"></i>
                                <span>Total: <strong id="total-spectators">0</strong></span>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-heart" style="color: #e74c3c;"></i>
                                <span>Vermelhas: <strong id="red-supporters-count">0</strong></span>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-heart" style="color: #2c3e50;"></i>
                                <span>Pretas: <strong id="black-supporters-count">0</strong></span>
                            </div>
                        </div>
                        
                        <div class="spectators-tabs">
                            <button class="tab-btn active" data-tab="all">Todos</button>
                            <button class="tab-btn" data-tab="red">Torcendo Vermelho</button>
                            <button class="tab-btn" data-tab="black">Torcendo Preto</button>
                        </div>
                        
                        <div class="spectators-list-container">
                            <div class="tab-content active" id="tab-all">
                                <h4>🎯 Todos os Espectadores</h4>
                                <div class="spectators-list" id="all-spectators-list">
                                    <div class="empty-state">Nenhum espectador no momento</div>
                                </div>
                            </div>
                            
                            <div class="tab-content" id="tab-red">
                                <h4>❤️ Torcendo pelas Vermelhas</h4>
                                <div class="spectators-list" id="red-spectators-list">
                                    <div class="empty-state">Ninguém torcendo pelas vermelhas</div>
                                </div>
                            </div>
                            
                            <div class="tab-content" id="tab-black">
                                <h4>🖤 Torcendo pelas Pretas</h4>
                                <div class="spectators-list" id="black-spectators-list">
                                    <div class="empty-state">Ninguém torcendo pelas pretas</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        console.log('Modal de espectadores criado');
    }
    
    // Inicializar a variável global
    spectatorsModal = document.getElementById('spectators-modal');
    
    if (!spectatorsModal) {
        console.error('❌ Modal de espectadores não foi criado corretamente');
        return;
    }
    
    // Configurar event listeners com verificações de segurança
    setupSpectatorsModalEvents();
    
    console.log('✅ Modal de espectadores inicializado com sucesso');
}

// ===== CONFIGURAR EVENTOS DO MODAL =====
function setupSpectatorsModalEvents() {
    // Remover event listeners existentes para evitar duplicação
    const newSpectatorsBtn = document.getElementById('btn-spectators').cloneNode(true);
    document.getElementById('btn-spectators').parentNode.replaceChild(newSpectatorsBtn, document.getElementById('btn-spectators'));
    
    // Event listener para abrir modal
    newSpectatorsBtn.addEventListener('click', openSpectatorsModal);
    
    // Event listener para fechar modal
    const closeBtn = document.getElementById('close-spectators');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSpectatorsModal);
    } else {
        console.error('Botão de fechar modal não encontrado (#close-spectators)');
    }
    
    // Fechar modal clicando fora
    if (spectatorsModal) {
        spectatorsModal.addEventListener('click', (e) => {
            if (e.target === spectatorsModal) {
                closeSpectatorsModal();
            }
        });
    }
    
    // Sistema de tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    if (tabButtons.length > 0) {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remover classe active de todos
                tabButtons.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                
                // Adicionar classe active ao selecionado
                btn.classList.add('active');
                const tabContent = document.getElementById(`tab-${btn.dataset.tab}`);
                if (tabContent) {
                    tabContent.classList.add('active');
                }
            });
        });
    }
}

// ===== FUNÇÃO PARA ABRIR MODAL =====
function openSpectatorsModal() {
    if (!spectatorsModal) {
        console.error('Modal de espectadores não inicializado');
        return;
    }
    
    // Atualizar dados antes de abrir
    updateSpectatorsModal();
    
    spectatorsModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    console.log('Modal de espectadores aberto');
}

// ===== FUNÇÃO PARA FECHAR MODAL =====
function closeSpectatorsModal() {
    if (spectatorsModal) {
        spectatorsModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ===== FUNÇÃO PARA ATUALIZAR MODAL =====
function updateSpectatorsModal() {
    if (!spectatorsModal || !spectatorsModal.classList.contains('active')) return;
    
    // Usar dados atuais dos espectadores
    const totalSpectators = currentSpectators?.length || 0;
    const redSupporters = currentSpectators?.filter(s => s.supporting === 'red').length || 0;
    const blackSupporters = currentSpectators?.filter(s => s.supporting === 'black').length || 0;
    
    // Atualizar estatísticas
    const totalEl = document.getElementById('total-spectators');
    const redEl = document.getElementById('red-supporters-count');
    const blackEl = document.getElementById('black-supporters-count');
    
    if (totalEl) totalEl.textContent = totalSpectators;
    if (redEl) redEl.textContent = redSupporters;
    if (blackEl) blackEl.textContent = blackSupporters;
    
    // Atualizar listas
    updateSpectatorsList('all', currentSpectators || []);
    updateSpectatorsList('red', currentSpectators?.filter(s => s.supporting === 'red') || []);
    updateSpectatorsList('black', currentSpectators?.filter(s => s.supporting === 'black') || []);
}

// ===== FUNÇÃO PARA ATUALIZAR LISTA =====
function updateSpectatorsList(type, spectators) {
    const listElement = document.getElementById(`${type}-spectators-list`);
    if (!listElement) return;
    
    if (spectators.length === 0) {
        listElement.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-${type === 'all' ? 'eye-slash' : 'heart-broken'}"></i>
                <p>${type === 'all' ? 'Nenhum espectador no momento' : 
                   type === 'red' ? 'Ninguém torcendo pelas vermelhas' : 
                   'Ninguém torcendo pelas pretas'}</p>
            </div>
        `;
        return;
    }
    
    listElement.innerHTML = spectators.map(spectator => `
        <div class="spectator-item ${spectator.supporting ? 'supporting' : ''}">
            <div class="spectator-avatar">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(spectator.displayName)}&background=random" 
                     alt="${spectator.displayName}">
                ${spectator.supporting ? `
                    <div class="support-badge ${spectator.supporting}" style="background: ${spectator.supporting === 'red' ? '#e74c3c' : '#2c3e50'}">
                        <i class="fas fa-heart"></i>
                    </div>
                ` : ''}
            </div>
            <div class="spectator-info">
                <span class="spectator-name">${spectator.displayName}</span>
                <span class="spectator-status">
                    ${spectator.supporting ? 
                        `Torcendo para ${spectator.supporting === 'red' ? 'vermelhas' : 'pretas'}` : 
                        'Apenas assistindo'}
                </span>
            </div>
            <div class="spectator-time">
                ${formatTimeAgo(spectator.joinedAt)}
            </div>
        </div>
    `).join('');
}

// ===== FUNÇÃO FORMATAR TEMPO (SE NÃO EXISTIR) =====
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Agora';
    
    try {
        const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - time;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'Agora';
        if (minutes < 60) return `Há ${minutes} min`;
        if (minutes < 1440) return `Há ${Math.floor(minutes / 60)} h`;
        return `Há ${Math.floor(minutes / 1440)} d`;
    } catch (error) {
        return 'Agora';
    }
}




// ===== FUNÇÃO MANAGE GAME TIMER =====
function manageGameTimer(oldGameState, newGameState) {
    if (!newGameState || !oldGameState) return;
    
    // Verificar se houve mudança de turno
    const turnChanged = oldGameState.currentTurn !== newGameState.currentTurn;
    const timeLimitChanged = oldGameState.timeLimit !== newGameState.timeLimit;
    const lastMoveTimeChanged = oldGameState.lastMoveTime !== newGameState.lastMoveTime;
    
    // Se o jogo começou agora
    const gameJustStarted = oldGameState.status !== 'playing' && newGameState.status === 'playing';
    
    // Se precisamos gerenciar o timer
    if (turnChanged || timeLimitChanged || lastMoveTimeChanged || gameJustStarted) {
        console.log('⏰ Gerenciando timer do jogo');
        
        // Parar timer anterior
        stopMoveTimer();
        
        // Configurar novo time limit se disponível
        if (newGameState.timeLimit) {
            currentTimeLimit = newGameState.timeLimit;
        }
        
        // Verificar se é a vez do jogador atual
        const currentPlayer = newGameState.players.find(p => p.uid === currentUser.uid);
        const isMyTurn = currentPlayer && currentPlayer.color === newGameState.currentTurn;
        
        if (isMyTurn && newGameState.status === 'playing') {
            // Calcular tempo restante baseado no lastMoveTime
            if (newGameState.lastMoveTime) {
                const lastMoveTime = newGameState.lastMoveTime.toDate 
                    ? newGameState.lastMoveTime.toDate() 
                    : new Date(newGameState.lastMoveTime);
                
                const elapsedSeconds = Math.floor((new Date() - lastMoveTime) / 1000);
                timeLeft = Math.max(0, currentTimeLimit - elapsedSeconds);
                
                console.log(`Tempo decorrido: ${elapsedSeconds}s, Tempo restante: ${timeLeft}s`);
            } else {
                timeLeft = currentTimeLimit;
            }
            
            // Iniciar timer
            startMoveTimer();
        } else {
            // Não é a vez do jogador ou jogo não está em andamento
            stopMoveTimer();
            updateTimerDisplay();
        }
    }
}

// ===== FUNÇÃO START MOVE TIMER (ATUALIZADA) =====
function startMoveTimer() {
    // Verificar condições antes de iniciar
    if (!gameState || 
        gameState.status !== 'playing' || 
        !gameState.players || 
        gameState.players.length < 2) {
        return;
    }
    
    // Verificar se é realmente a vez do jogador
    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
    if (!currentPlayer || currentPlayer.color !== gameState.currentTurn) {
        return;
    }
    
    // Limpar timer anterior
    stopMoveTimer();
    
    // Verificar se há limite de tempo
    if (currentTimeLimit <= 0) {
        updateTimerDisplay();
        return;
    }
    
    updateTimerDisplay();
    
    moveTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            timeExpired();
        }
        
        // Alertas visuais
        if (timeLeft === 30) {
            showNotification('30 segundos restantes!', 'warning');
        } else if (timeLeft === 10) {
            showNotification('10 segundos restantes!', 'error');
        }
    }, 1000);
    
    console.log('Timer iniciado para jogador:', currentPlayer.displayName);
}

// ===== FUNÇÃO STOP MOVE TIMER =====
function stopMoveTimer() {
    if (moveTimer) {
        clearInterval(moveTimer);
        moveTimer = null;
    }
}

// ===== FUNÇÃO UPDATE TIMER DISPLAY =====
function updateTimerDisplay() {
    const timerElement = document.getElementById('game-timer');
    if (!timerElement) return;
    
    if (currentTimeLimit <= 0) {
        timerElement.textContent = '∞';
        timerElement.className = 'game-timer infinite';
        return;
    }
    
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Mudar cor conforme o tempo diminui
    if (timeLeft <= 10) {
        timerElement.className = 'game-timer critical';
    } else if (timeLeft <= 30) {
        timerElement.className = 'game-timer warning';
    } else {
        timerElement.className = 'game-timer';
    }
}
// ===== FUNÇÃO TIME EXPIRED (CORRIGIDA) =====
async function timeExpired() {
    console.log('Tempo esgotado! Finalizando jogo...');
    stopMoveTimer();
    
    if (!currentGameRef || !gameState || !hasGameStarted()) return;
    
    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
    
    // Verificar se ainda é a vez do jogador
    if (currentPlayer && currentPlayer.color === gameState.currentTurn) {
        try {
            showNotification('Tempo esgotado! Você perdeu.', 'error');
            
            // Determinar vencedor (oponente)
            const winner = currentPlayer.color === 'red' ? 'black' : 'red';
            const winningPlayer = gameState.players.find(p => p.color === winner);
            
            if (!winningPlayer) {
                console.error('Jogador vencedor não encontrado');
                return;
            }
            
            const betAmount = gameState.bet || 0;
            
            if (betAmount > 0) {
                // 🔥 CORREÇÃO: Cálculo correto do prêmio
                const calculation = calculatePrize(betAmount);
                
                // Vencedor recebe o prêmio líquido
                await db.collection('users').doc(winningPlayer.uid).update({
                    coins: firebase.firestore.FieldValue.increment(calculation.winnerPrize),
                    wins: firebase.firestore.FieldValue.increment(1),
                    rating: firebase.firestore.FieldValue.increment(10)
                });
                
                // Registrar lucro da plataforma
                await db.collection('platformEarnings').add({
                    amount: calculation.platformFee,
                    betAmount: betAmount,
                    tableId: currentGameRef.id,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    winner: winningPlayer.uid,
                    timeout: true
                });
                
            } else {
                // Sem aposta - apenas estatísticas
                await db.collection('users').doc(winningPlayer.uid).update({
                    wins: firebase.firestore.FieldValue.increment(1),
                    rating: firebase.firestore.FieldValue.increment(10)
                });
            }
            
            // Atualizar perdedor
            await db.collection('users').doc(currentPlayer.uid).update({
                losses: firebase.firestore.FieldValue.increment(1),
                rating: firebase.firestore.FieldValue.increment(-15)
            });
            
            // Atualizar estado do jogo com vitória por tempo
            await currentGameRef.update({
                status: 'finished',
                winner: winner,
                finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                resultText: `Vitória por tempo - ${winningPlayer.displayName}`,
                timeout: true,
                timeoutBy: currentUser.uid,
                timeoutByName: currentPlayer.displayName
            });
            
            console.log('Jogo finalizado por tempo esgotado');
            
            // Notificar vencedor
            if (winningPlayer.uid) {
                await db.collection('notifications').add({
                    type: 'timeout_win',
                    userId: winningPlayer.uid,
                    message: `${currentPlayer.displayName} ficou sem tempo! Você venceu!`,
                    tableId: currentGameRef.id,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false
                });
            }
            
            // Redirecionar após 3 segundos
            setTimeout(() => {
                leaveGame();
            }, 3000);
            
        } catch (error) {
            console.error('Erro ao finalizar jogo por tempo:', error);
            showNotification('Erro ao processar fim de tempo', 'error');
        }
    }
}

// ===== FUNÇÃO HAS GAME STARTED =====
function hasGameStarted() {
    return gameState && 
           gameState.status === 'playing' && 
           gameState.players && 
           gameState.players.length === 2;
}

// ===== SISTEMA DE RECONEXÃO =====
let connectionLostTime = null;

function setupConnectionMonitoring() {
    // Monitorar perda de conexão
    const databaseRef = firebase.database().ref('.info/connected');
    databaseRef.on('value', (snap) => {
        if (snap.val() === true) {
            console.log('Conectado ao Firebase');
            connectionLostTime = null;
        } else {
            console.log('Desconectado do Firebase');
            connectionLostTime = new Date();
            
            // Pausar timer se estiver ativo
            if (moveTimer && hasGameStarted()) {
                stopMoveTimer();
                showNotification('Conexão perdida - timer pausado', 'warning');
            }
        }
    });
    
    // Monitorar reconexão
    window.addEventListener('online', () => {
        if (connectionLostTime && hasGameStarted()) {
            const disconnectTime = (new Date() - connectionLostTime) / 1000;
            console.log('Tempo desconectado:', disconnectTime, 'segundos');
            
            // Recuperar tempo perdido (máximo 30 segundos de compensação)
            const compensation = Math.min(disconnectTime, 30);
            if (compensation > 5) {
                timeLeft += Math.floor(compensation);
                updateTimerDisplay();
                showNotification(`Compensação de ${Math.floor(compensation)}s por perda de conexão`, 'info');
            }
            
            // Reiniciar timer se for a vez do jogador
            const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
            if (currentPlayer && currentPlayer.color === gameState.currentTurn) {
                startMoveTimer();
            }
        }
    });
}


// ===== CHECK USER ACTIVE TABLE (ATUALIZADA) =====
async function checkUserActiveTable(userId = null) {
    const targetUserId = userId || currentUser?.uid;
    
    if (!targetUserId || !db) {
        return { hasActiveTable: false };
    }
    
    try {
        const snapshot = await db.collection('tables')
            .where('players', 'array-contains', { uid: targetUserId })
            .where('status', 'in', ['waiting', 'playing'])
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const table = snapshot.docs[0].data();
            return {
                hasActiveTable: true,
                tableId: snapshot.docs[0].id,
                tableName: table.name,
                tableBet: table.bet || 0,
                tableStatus: table.status,
                tableTimeLimit: table.timeLimit,
                players: table.players || []
            };
        }
        
        return { hasActiveTable: false };
    } catch (error) {
        console.error('Erro ao verificar mesa ativa:', error);
        return { hasActiveTable: false };
    }
}


// ===== SETUP ACTIVE TABLE LISTENER (CORRIGIDA) =====
function setupActiveTableListener() {
     // Garantir que a variável existe
    if (!activeTableListener) {
        activeTableListener = null;
    } 
     // Garantir que a variável existe
    if (!activeTableListener) {
        activeTableListener = null;
    }
    
    if (!currentUser || !db) {
        console.log('❌ setupActiveTableListener: currentUser ou db não disponível');
        return;
    }
    
    console.log('🔍 Iniciando listener de mesa ativa para:', currentUser.uid);
    
    try {
        activeTableListener = db.collection('tables')
            .where('players', 'array-contains', { uid: currentUser.uid })
            .where('status', 'in', ['waiting', 'playing'])
            .onSnapshot(async (snapshot) => {
                console.log('📊 Atualização de mesa ativa recebida:', snapshot.size, 'mesas');
                
                if (snapshot.empty) {
                    // Nenhuma mesa ativa
                    userActiveTable = null;
                    console.log('✅ Usuário não está em nenhuma mesa');
                } else {
                    // Usuário está em uma mesa
                    const tableDoc = snapshot.docs[0];
                    userActiveTable = tableDoc.id;
                    const tableData = tableDoc.data();
                    
                    console.log('🎯 Usuário está na mesa:', userActiveTable, tableData.status);
                    
                    // Se a mesa estiver esperando, atualizar a lista de usuários online
                    if (tableData.status === 'waiting') {
                        setTimeout(() => {
                            if (typeof refreshOnlineUsersList === 'function') {
                                refreshOnlineUsersList();
                            }
                        }, 500);
                    }
                }
                
                // Atualizar UI
                if (typeof updateCreateButtonStatus === 'function') {
                    updateCreateButtonStatus();
                }
                
            }, (error) => {
                console.error('❌ Erro no listener de mesa ativa:', error);
            });
            
    } catch (error) {
        console.error('❌ Erro ao configurar listener de mesa ativa:', error);
    }
}
// Função para atualizar a lista de usuários online
function refreshOnlineUsersList() {
    if (typeof loadOnlineUsers === 'function') {
        console.log('🔄 Atualizando lista de usuários online...');
        loadOnlineUsers();
    }
}



// ===== UPDATE CREATE BUTTON STATUS =====
function updateCreateButtonStatus() {
    const createButton = document.getElementById('btn-create-table');
    if (!createButton) return;
    
    if (userActiveTable) {
        createButton.disabled = true;
        createButton.title = 'Você já tem uma mesa ativa';
        createButton.innerHTML = '<i class="fas fa-ban"></i> Mesa Ativa';
        createButton.classList.add('disabled');
    } else {
        createButton.disabled = false;
        createButton.title = 'Criar nova mesa';
        createButton.innerHTML = '<i class="fas fa-plus"></i> Criar Mesa';
        createButton.classList.remove('disabled');
    }
}
// Chamar esta função quando o estado mudar
function setUserActiveTable(tableId) {
    userActiveTable = tableId;
    updateCreateButtonStatus();
}



// ===== FORÇAR SAÍDA DE MESA =====
async function forceLeaveTable() {
    if (!userActiveTable) return;
    
    try {
        const confirm = await showConfirmModal(
            'Sair da Mesa', 
            'Tem certeza que deseja sair da mesa atual? Isso pode resultar em derrota.'
        );
        
        if (confirm) {
            const tableRef = db.collection('tables').doc(userActiveTable);
            const tableDoc = await tableRef.get();
            
            if (tableDoc.exists) {
                const table = tableDoc.data();
                
                if (table.status === 'waiting') {
                    // Mesa em espera - apenas remover
                    await tableRef.delete();
                    showNotification('Mesa removida', 'info');
                } else if (table.status === 'playing') {
                    // Mesa em jogo - marcar como desistência
                    const winner = table.players.find(p => p.uid !== currentUser.uid)?.color;
                    if (winner) {
                        await endGame(winner);
                    }
                }
            }
            
            userActiveTable = null;
            updateCreateButtonStatus();
        }
    } catch (error) {
        console.error('Erro ao forçar saída:', error);
        showNotification('Erro ao sair da mesa', 'error');
    }
}



// ===== CONFIRMAR SAÍDA DO JOGO =====
async function confirmLeaveGame() {
    if (!currentGameRef || !gameState) return;
    
    let message = '';
    let confirmText = 'Sair';
    let cancelText = 'Ficar';
    
    // Mensagens diferentes dependendo do status do jogo
    if (gameState.status === 'waiting') {
        message = 'Tem certeza que deseja sair da mesa? A mesa será excluída e qualquer aposta será perdida.';
        confirmText = 'Excluir Mesa';
    } else if (gameState.status === 'playing') {
        const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
        const isMyTurn = currentPlayer && currentPlayer.color === gameState.currentTurn;
        
        if (isMyTurn) {
            message = 'Tem certeza que deseja sair do jogo? Isso será considerado uma desistência e você perderá a partida!';
            confirmText = 'Desistir';
        } else {
            message = 'Tem certeza que deseja sair do jogo? Isso será considerado uma desistência!';
            confirmText = 'Desistir';
        }
    } else {
        message = 'Tem certeza que deseja sair do jogo?';
    }
    
    const confirm = await showConfirmModal('Confirmar Saída', message, confirmText, cancelText);
    
    if (confirm) {
        await handleActualLeave();
    }
}


// ===== TRATAR SAÍDA REAL =====
async function handleActualLeave() {
    try {
        console.log('Processando saída do jogo...');
        
        if (!currentGameRef || !gameState) {
            leaveGame();
            return;
        }
        
        const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
        
        // Diferentes ações dependendo do status
        if (gameState.status === 'waiting') {
            // Mesa em espera - excluir completamente
            await deleteWaitingTable();
        } else if (gameState.status === 'playing' && currentPlayer) {
            // Mesa em jogo - marcar como desistência
            await surrenderFromGame();
        } else {
            // Outros casos - apenas sair
            leaveGame();
        }
        
    } catch (error) {
        console.error('Erro ao processar saída:', error);
        showNotification('Erro ao sair do jogo', 'error');
        leaveGame(); // Fallback
    }
}
// ===== EXCLUIR MESA EM ESPERA =====
async function deleteWaitingTable() {
    try {
        const tableDoc = await currentGameRef.get();
        if (!tableDoc.exists) {
            leaveGame();
            return;
        }
        
        const table = tableDoc.data();
        
        // Devolver aposta se houver
        if (table.bet > 0) {
            await db.collection('users').doc(currentUser.uid).update({
                coins: firebase.firestore.FieldValue.increment(table.bet)
            });
            userData.coins += table.bet;
            showNotification(`Aposta de ${table.bet} moedas devolvida`, 'info');
        }
        
        // Excluir mesa
        await currentGameRef.delete();
        showNotification('Mesa excluída', 'info');
        
        leaveGame();
        
    } catch (error) {
        console.error('Erro ao excluir mesa:', error);
        showNotification('Erro ao excluir mesa', 'error');
        leaveGame();
    }
}

// ===== CONFIRMAR SAÍDA DA MESA DE ESPERA =====
async function confirmLeaveWaitingRoom() {
    if (!currentGameRef || !gameState) return;
    
    // Se a mesa está esperando oponente, oferecer opções
    if (gameState.status === 'waiting') {
        const choice = await showWaitingRoomOptions();
        
        switch (choice) {
            case 'stay':
                // Ficar na mesa (não fazer nada)
                return;
            case 'browse':
                // Navegar mantendo a mesa aberta
                await minimizeWaitingRoom();
                break;
            case 'leave':
                // Sair e deletar a mesa
                await deleteWaitingTable();
                break;
        }
    } else {
        // Para jogos em andamento, usar confirmação normal
        confirmLeaveGame();
    }
}

// ===== MODAL DE OPÇÕES PARA MESA EM ESPERA =====
async function showWaitingRoomOptions() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal waiting-room-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>⏳ Esperando Oponente</h3>
                </div>
                <div class="modal-body">
                    <div class="waiting-options">
                        <div class="option" data-option="stay">
                            <i class="fas fa-eye"></i>
                            <div>
                                <h4>Ficar Assistindo</h4>
                                <p>Continue nesta tela aguardando um oponente</p>
                            </div>
                        </div>
                        
                        <div class="option" data-option="browse">
                            <i class="fas fa-list"></i>
                            <div>
                                <h4>Navegar nas Mesas</h4>
                                <p>Volte à lista de mesas enquanto espera</p>
                                <small>Você será notificado quando alguém entrar</small>
                            </div>
                        </div>
                        
                        <div class="option" data-option="leave">
                            <i class="fas fa-times"></i>
                            <div>
                                <h4>Cancelar Mesa</h4>
                                <p>Excluir esta mesa e voltar ao início</p>
                                <small>Sua aposta será devolvida</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.add('active');
        
        // Event listeners para as opções
        const options = modal.querySelectorAll('.option');
        options.forEach(option => {
            option.addEventListener('click', () => {
                const selectedOption = option.dataset.option;
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
                resolve(selectedOption);
            });
        });
        
        // Fechar ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
                resolve('stay');
            }
        });
    });
}

// ===== MINIMIZAR SALA DE ESPERA =====
async function minimizeWaitingRoom() {
    // Manter o listener ativo para detectar quando oponente entrar
    if (gameListener) {
        // Não remover o listener - manter monitorando
        console.log('Mantendo mesa em espera em segundo plano');
    }
    
    // Mostrar notificação
    showNotification('Mesa mantida em espera. Você será notificado quando um oponente entrar.', 'info');
    
    // Voltar para a lista de mesas
    showScreen('main-screen');
    loadTables();
    
    // Adicionar badge indicando mesa ativa
    addWaitingTableBadge();
}

// ===== BADGE DE MESA EM ESPERA =====
function addWaitingTableBadge() {
    // Adicionar badge no botão de mesas
    const tablesBtn = document.querySelector('[data-tab="tables"]');
    if (tablesBtn && !tablesBtn.querySelector('.waiting-badge')) {
        const badge = document.createElement('span');
        badge.className = 'waiting-badge';
        badge.innerHTML = '<i class="fas fa-clock"></i>';
        badge.title = 'Você tem uma mesa em espera';
        tablesBtn.appendChild(badge);
    }
}






// ===== ATUALIZAR CONTAGEM DE ESPECTADORES NA MESA =====
async function updateTableSpectatorsCount(tableId, spectatorsCount) {
    try {
        await db.collection('tables').doc(tableId).update({
            spectatorsCount: spectatorsCount,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Erro ao atualizar contagem de espectadores:', error);
    }
}




// ===== EVENT LISTENER GLOBAL COMO FALLBACK =====
document.addEventListener('DOMContentLoaded', function() {
    // Tentar adicionar event listener ao botão após o DOM carregar
    setTimeout(() => {
        const onlineUsersBtn = document.getElementById('btn-online-users');
        if (onlineUsersBtn) {
            console.log('Adicionando event listener global ao botão...');
            onlineUsersBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                openOnlineUsersModal();
            });
        }
    }, 2000); // Delay de 2 segundos para garantir que tudo carregou
});

// Event delegation para caso o botão seja adicionado dinamicamente
document.addEventListener('click', function(e) {
    if (e.target.id === 'btn-online-users' || e.target.closest('#btn-online-users')) {
        e.preventDefault();
        e.stopPropagation();
        openOnlineUsersModal();
    }
});



// ===== INICIALIZAR SISTEMA DE NOTIFICAÇÕES DE DESAFIO =====
// ===== INICIALIZAR SISTEMA DE NOTIFICAÇÕES DE DESAFIO =====
// ===== INICIALIZAR SISTEMA DE NOTIFICAÇÕES DE DESAFIO =====
function initializeChallengeNotifications() {
    console.log('Inicializando sistema de notificações de desafio...');
    
    // Criar container de notificações
    createNotificationContainer();
    
    // Configurar som de notificação
    setupNotificationSound();
    
    // Só iniciar listeners se usuário estiver logado
    if (currentUser) {
        console.log('Usuário logado, iniciando listeners de desafio...');
        
        // Listener para desafios recebidos
        setupChallengeListener();
        
        // 🔥 NOVO: Listener para desafios aceitos
        setupChallengeAcceptedListener();
    }
}


// ===== MOSTRAR NOTIFICAÇÃO DE DESAFIO ACEITO =====
function showChallengeAcceptedNotification(notification) {
    const notificationEl = document.createElement('div');
    notificationEl.className = 'game-notification challenge-accepted';
    notificationEl.innerHTML = `
        <div class="notification-glowing-border" style="background: linear-gradient(90deg, #00ff88, #ffd700, #00ff88);"></div>
        <div class="notification-header">
            <div class="notification-icon">🎯</div>
            <h3 class="notification-title">DESAFIO ACEITO!</h3>
        </div>
        
        <div class="notification-content">
            <p><strong>${notification.fromUserName}</strong> aceitou seu desafio!</p>
            <p>Pronto para jogar?</p>
        </div>
        
        <div class="notification-actions">
            <button class="notification-btn accept" onclick="joinChallengeTable('${notification.tableId}', '${notification.id}')">
                <i class="fas fa-play"></i> ENTRAR NA MESA
            </button>
        </div>
        
        <div class="notification-timer">
            Mesa aguardando sua entrada...
        </div>
    `;
    
    const notificationSystem = getNotificationContainer();
    notificationSystem.appendChild(notificationEl);
    
    // Animação de entrada
    setTimeout(() => {
        notificationEl.classList.add('show');
    }, 100);
    
    // Auto-remover após 30 segundos
    setTimeout(() => {
        if (notificationEl.parentNode) {
            notificationEl.classList.remove('show');
            setTimeout(() => notificationEl.remove(), 500);
        }
    }, 30000);
}

// ===== ENTRAR NA MESA DE DESAFIO =====
async function joinChallengeTable(tableId, notificationId) {
    try {
        console.log('Entrando na mesa de desafio:', tableId);
        
        // Entrar na mesa
        await joinTable(tableId);
        
        // Marcar notificação como processada
        if (notificationId) {
            await db.collection('notifications').doc(notificationId).update({
                status: 'processed',
                processedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
    } catch (error) {
        console.error('Erro ao entrar na mesa de desafio:', error);
        showNotification('Erro ao entrar na mesa', 'error');
    }
}


// ===== TESTAR CONTAINER DE NOTIFICAÇÕES =====
function testNotificationContainer() {
    console.log('=== TESTANDO CONTAINER DE NOTIFICAÇÕES ===');
    
    // Testar se o container existe
    const container = document.getElementById('notification-system');
    console.log('Container existe:', !!container);
    
    if (container) {
        console.log('Container no DOM:', !!container.parentNode);
        console.log('Container HTML:', container.outerHTML);
    } else {
        console.log('Criando container...');
        createNotificationContainer();
        console.log('Container criado:', !!document.getElementById('notification-system'));
    }
}

// Adicione ao window para testar
window.testContainer = testNotificationContainer;

// ===== OBTER CONTAINER DE NOTIFICAÇÕES COM FALLBACK =====
function getNotificationContainer() {
    let container = document.getElementById('notification-system');
    
    if (!container) {
        console.log('Container não encontrado, criando...');
        createNotificationContainer();
        container = document.getElementById('notification-system');
    }
    
    // Verificar se o container está no DOM
    if (!container.parentNode) {
        console.log('Container não está no DOM, recolocando...');
        document.body.appendChild(container);
    }
    
    return container;
}


// ===== CRIAR CONTAINER DE NOTIFICAÇÕES =====
function createNotificationContainer() {
    // Remover container existente se houver
    const existingContainer = document.getElementById('notification-system');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    // Criar novo container
    const notificationHTML = `
        <div class="notification-system" id="notification-system"></div>
    `;
    document.body.insertAdjacentHTML('beforeend', notificationHTML);
    
    console.log('✅ Container de notificações criado');
}
// ===== CONFIGURAR SOM DE NOTIFICAÇÃO =====
function setupNotificationSound() {
    try {
        // Criar contexto de áudio
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        
        // Função para criar som de notificação
        function createNotificationSound() {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1760, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        }
        
        notificationSound = createNotificationSound;
        
    } catch (error) {
        console.log('Áudio não disponível para notificações');
        notificationSound = null;
    }
}

// ===== CONFIGURAR LISTENER DE DESAFIOS =====
function setupChallengeListener() {
    if (!currentUser || !db) {
        console.log('Não é possível configurar listener: usuário ou DB não disponível');
        return null;
    }
    
    console.log('Configurando listener de desafios para usuário:', currentUser.uid);
    
    // Remover listener anterior se existir
    if (window.challengeListener) {
        window.challengeListener();
    }
    
    try {
        // Listener para notificações de desafio DESTE usuário
        window.challengeListener = db.collection('notifications')
            .where('toUserId', '==', currentUser.uid)
            .where('type', '==', 'challenge')
            .where('status', '==', 'pending')
            .orderBy('timestamp', 'desc')
            .onSnapshot(async (snapshot) => {
                console.log('📨 Mudança detectada em notificações de desafio');
                console.log('Mudanças:', snapshot.docChanges().length);
                
                snapshot.docChanges().forEach(async (change) => {
                    console.log('📩 Mudança tipo:', change.type, 'ID:', change.doc.id);
                    
                    if (change.type === 'added') {
                        const notification = {
                            id: change.doc.id,
                            ...change.doc.data()
                        };
                        
                        console.log('🎯 Nova notificação recebida:', {
                            from: notification.fromUserName,
                            to: notification.toUserId,
                            message: notification.message
                        });
                        
                        // Verificar se a notificação é para este usuário
                        if (notification.toUserId === currentUser.uid) {
                            console.log('✅ Notificação é para mim! Mostrando...');
                            // Mostrar notificação de desafio
                            await showChallengeNotification(notification);
                            
                            // Marcar como visualizada
                            await markNotificationAsSeen(notification.id);
                        } else {
                            console.log('❌ Notificação não é para mim. Ignorando.');
                        }
                    }
                });
            }, (error) => {
                console.error('❌ Erro no listener de desafios:', error);
                console.error('Código do erro:', error.code);
            });
            
        console.log('✅ Listener de desafios configurado com sucesso');
        return window.challengeListener;
            
    } catch (error) {
        console.error('❌ Erro ao configurar listener de desafios:', error);
        return null;
    }
}

// ===== VERIFICAR LISTENER ATIVO =====
function checkActiveListener() {
    console.log('=== VERIFICANDO LISTENER ATIVO ===');
    console.log('Usuário atual:', currentUser ? currentUser.uid : 'Nenhum');
    console.log('Listener configurado:', !!window.challengeListener);
    
    if (window.challengeListener) {
        console.log('✅ Listener está ativo');
    } else {
        console.log('❌ Nenhum listener ativo');
    }
}

// Adicione ao window para testar
window.checkListener = checkActiveListener;
// ===== SHOW CHALLENGE NOTIFICATION (CORRIGIDA) =====
function showChallengeNotification(notification) {
    console.log('🎯 Mostrando notificação de desafio:', notification);
    
    // Garantir que audioManager existe e tem o método
    if (audioManager && typeof audioManager.playChallengeSound === 'function') {
        audioManager.playChallengeSound();
    } else {
        console.warn('audioManager.playChallengeSound não disponível');
        // Fallback para outro som
        if (audioManager && typeof audioManager.playNotificationSound === 'function') {
            audioManager.playNotificationSound();
        }
    }
    
    // Garantir que activeNotifications existe
    if (!activeNotifications) {
        activeNotifications = new Map();
        console.warn('activeNotifications não estava inicializado, criando novo Map');
    }
    
    const notificationId = 'challenge-' + Date.now();
    const notificationElement = createNotificationElement(notification, notificationId);
    
    // Adicionar ao contêiner de notificações
    const notificationsContainer = document.getElementById('notifications-container') || createNotificationsContainer();
    notificationsContainer.appendChild(notificationElement);
    
    // Adicionar ao mapa de notificações ativas
    activeNotifications.set(notificationId, {
        element: notificationElement,
        data: notification,
        timer: setTimeout(() => removeNotification(notificationId), 10000)
    });
    
    // Animar entrada
    setTimeout(() => {
        notificationElement.classList.add('show');
    }, 100);
    
    // Configurar evento de clique
    notificationElement.addEventListener('click', () => {
        handleChallengeClick(notification);
        removeNotification(notificationId);
    });
}

// ===== FUNÇÕES AUXILIARES (SE NÃO EXISTIREM) =====
function createNotificationElement(notification, id) {
    const element = document.createElement('div');
    element.className = 'notification challenge';
    element.id = id;
    element.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-trophy"></i>
            <div>
                <strong>${notification.fromUserName} te desafiou!</strong>
                <p>${notification.message || 'Partida de damas'}</p>
                <small>Tempo: ${notification.timeLimit}s | Aposta: ${notification.betAmount || 0} moedas</small>
            </div>
        </div>
        <button class="notification-close">&times;</button>
    `;
    
    // Evento para fechar
    element.querySelector('.notification-close').addEventListener('click', (e) => {
        e.stopPropagation();
        removeNotification(id);
    });
    
    return element;
}

function createNotificationsContainer() {
    const container = document.createElement('div');
    container.id = 'notifications-container';
    container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 350px;
    `;
    document.body.appendChild(container);
    return container;
}

function removeNotification(id) {
    if (activeNotifications && activeNotifications.has(id)) {
        const notification = activeNotifications.get(id);
        
        // Remover elemento com animação
        notification.element.classList.remove('show');
        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
        }, 300);
        
        // Limpar timer e remover do mapa
        clearTimeout(notification.timer);
        activeNotifications.delete(id);
    }
}

function handleChallengeClick(notification) {
    console.log('Desafio clicado:', notification);
    // Aqui você implementaria a lógica para aceitar o desafio
    showNotification('Funcionalidade de aceitar desafio em desenvolvimento', 'info');
}

// ===== VERIFICAÇÃO DE SEGURANÇA PARA DOM =====
function isDOMReady() {
    return document.readyState === 'complete' || document.readyState === 'interactive';
}

function waitForDOM() {
    return new Promise((resolve) => {
        if (isDOMReady()) {
            resolve();
        } else {
            document.addEventListener('DOMContentLoaded', resolve);
            window.addEventListener('load', resolve);
            
            // Timeout de segurança
            setTimeout(resolve, 5000);
        }
    });
}


// ===== OBSERVAR MUDANÇAS NO DOM =====
function setupDOMMutationObserver() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.removedNodes.length > 0) {
                mutation.removedNodes.forEach((node) => {
                    if (node.id === 'notification-system') {
                        console.log('⚠️ Container de notificações removido do DOM, recriando...');
                        createNotificationContainer();
                    }
                });
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}


// ===== ATUALIZAR TIMER DA NOTIFICAÇÃO =====
function updateNotificationTimer(notificationId) {
    const notification = activeNotifications.get(notificationId);
    if (!notification) return;
    
    const timeLeft = Math.max(0, Math.floor((notification.expiresAt - new Date()) / 1000));
    const timerElement = document.getElementById(`timer-${notificationId}`);
    
    if (timerElement) {
        timerElement.textContent = `Expira em: ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`;
    }
    
    // Adicionar efeito de urgência se faltar pouco tempo
    if (timeLeft < 60 && !notification.element.classList.contains('notification-urgent')) {
        notification.element.classList.add('notification-urgent');
    }
    
    if (timeLeft <= 0) {
        removeChallengeNotification(notificationId, 'expired');
    }
}

// ===== ACEITAR DESAFIO =====
async function acceptChallenge(notificationId) {
    console.log('Aceitando desafio:', notificationId);
    
    try {
        const notification = activeNotifications.get(notificationId);
        if (!notification) {
            console.log('Notificação não encontrada nas notificações ativas');
            return;
        }
        
        // Buscar dados completos do desafio do Firestore
        const challengeDoc = await db.collection('notifications').doc(notificationId).get();
        
        if (!challengeDoc.exists) {
            console.error('Desafio não encontrado no Firestore');
            showNotification('Desafio não encontrado', 'error');
            return;
        }
        
        const challenge = {
            id: challengeDoc.id,
            ...challengeDoc.data()
        };
        
        console.log('Dados completos do desafio:', challenge);
        
        // Atualizar status da notificação
        await db.collection('notifications').doc(notificationId).update({
            status: 'accepted',
            respondedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Criar mesa para o desafio
        await createChallengeTable(challenge);
        
        // Remover notificação
        removeChallengeNotification(notificationId, 'accepted');
        
        showNotification('Desafio aceito! Criando mesa...', 'success');
        
    } catch (error) {
        console.error('Erro ao aceitar desafio:', error);
        showNotification('Erro ao aceitar desafio: ' + error.message, 'error');
    }
}

// ===== VALIDAR DADOS DO DESAFIO =====
function validateChallengeData(challenge) {
    if (!challenge) {
        throw new Error('Dados do desafio são nulos');
    }
    
    if (!challenge.fromUserId) {
        throw new Error('ID do remetente não definido');
    }
    
    if (!challenge.fromUserName) {
        throw new Error('Nome do remetente não definido');
    }
    
    // Garantir valores padrão
    return {
        id: challenge.id || null,
        fromUserId: challenge.fromUserId,
        fromUserName: challenge.fromUserName || 'Desafiante',
        timeLimit: challenge.timeLimit || 60,
        betAmount: challenge.betAmount || 0,
        message: challenge.message || ''
    };
}


// ===== RECUSAR DESAFIO =====
async function declineChallenge(notificationId) {
    console.log('Recusando desafio:', notificationId);
    
    try {
        // Atualizar status da notificação
        await db.collection('notifications').doc(notificationId).update({
            status: 'declined',
            respondedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Remover notificação
        removeChallengeNotification(notificationId, 'declined');
        
        showNotification('Desafio recusado', 'info');
        
    } catch (error) {
        console.error('Erro ao recusar desafio:', error);
        showNotification('Erro ao recusar desafio', 'error');
    }
}

// ===== REMOVER NOTIFICAÇÃO =====
function removeChallengeNotification(notificationId, reason = 'dismissed') {
    const notification = activeNotifications.get(notificationId);
    if (!notification) return;
    
    // Parar timer
    clearInterval(notification.timer);
    
    // Animação de saída
    notification.element.classList.remove('show');
    notification.element.classList.add('hide');
    
    // Remover após animação
    setTimeout(() => {
        if (notification.element.parentNode) {
            notification.element.parentNode.removeChild(notification.element);
        }
        activeNotifications.delete(notificationId);
    }, 500);
    
    console.log(`Notificação ${notificationId} removida: ${reason}`);
}


// ===== CRIAR MESA PARA DESAFIO =====
async function createChallengeTable(challenge) {
    try {
        console.log('Criando mesa para desafio:', challenge);
        
        // Validar dados do desafio
        const validatedChallenge = validateChallengeData(challenge);
        
        const tableName = `Desafio: ${validatedChallenge.fromUserName} vs ${userData.displayName}`;
        
        const boardData = convertBoardToFirestoreFormat(initializeBrazilianCheckersBoard());
        
        const tableData = {
            name: tableName,
            timeLimit: validatedChallenge.timeLimit,
            bet: validatedChallenge.betAmount,
            status: 'waiting', // 🔥 MUDAR para 'waiting' inicialmente
            players: [
                {
                    uid: validatedChallenge.fromUserId,
                    displayName: validatedChallenge.fromUserName,
                    rating: 1000,
                    color: 'black'
                },
                {
                    uid: currentUser.uid,
                    displayName: userData.displayName,
                    rating: userData.rating,
                    color: 'red'
                }
            ],
            createdBy: validatedChallenge.fromUserId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            currentTurn: 'black',
            board: boardData,
            waitingForOpponent: true, // 🔥 Esperando o desafiante entrar
            platformFee: calculatePlatformFee(validatedChallenge.betAmount),
            isChallenge: true,
            challengeId: validatedChallenge.id || null
        };
        
        console.log('Dados da mesa validados:', tableData);
        
        const tableRef = await db.collection('tables').add(tableData);
        
        console.log('✅ Mesa de desafio criada com ID:', tableRef.id);
        
        // 🔥 NOTIFICAR O DESAFIANTE SOBRE A MESA CRIADA
        await notifyChallengerAboutTable(validatedChallenge.fromUserId, tableRef.id, validatedChallenge);
        
        // Entrar na mesa (quem aceitou)
        userActiveTable = tableRef.id;
        setupGameListener(tableRef.id);
        showScreen('game-screen');
        
        showNotification('Mesa criada! Aguardando o desafiante entrar...', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao criar mesa de desafio:', error);
        showNotification('Erro ao criar mesa: ' + error.message, 'error');
    }
}


// ===== NOTIFICAR DESAFIANTE SOBRE MESA CRIADA =====
async function notifyChallengerAboutTable(challengerUserId, tableId, challenge) {
    try {
        console.log('Notificando desafiante:', challengerUserId);
        
        // Criar notificação para o desafiante
        await db.collection('notifications').add({
            type: 'challenge_accepted',
            fromUserId: currentUser.uid,
            fromUserName: userData.displayName,
            toUserId: challengerUserId,
            message: `${userData.displayName} aceitou seu desafio! Clique para entrar na mesa.`,
            tableId: tableId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending',
            challengeData: challenge
        });
        
        console.log('✅ Desafiante notificado sobre a mesa');
        
    } catch (error) {
        console.error('❌ Erro ao notificar desafiante:', error);
    }
}

// ===== CONFIGURAR LISTENER PARA DESAFIOS ACEITOS =====
function setupChallengeAcceptedListener() {
    if (!currentUser || !db) {
        console.log('Não é possível configurar listener de desafios aceitos');
        return null;
    }
    
    console.log('Configurando listener de desafios aceitos para:', currentUser.uid);
    
    return db.collection('notifications')
        .where('toUserId', '==', currentUser.uid)
        .where('type', '==', 'challenge_accepted')
        .where('status', '==', 'pending')
        .orderBy('timestamp', 'desc')
        .onSnapshot(async (snapshot) => {
            console.log('Mudança em notificações de desafio aceito');
            
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const notification = {
                        id: change.doc.id,
                        ...change.doc.data()
                    };
                    
                    console.log('🎯 Desafio aceito recebido:', notification);
                    
                    // Mostrar notificação e entrar na mesa
                    await handleChallengeAccepted(notification);
                    
                    // Marcar como vista
                    await markNotificationAsSeen(notification.id);
                }
            });
        }, (error) => {
            console.error('Erro no listener de desafios aceitos:', error);
        });
}

// ===== LIDAR COM DESAFIO ACEITO =====
// ===== LIDAR COM DESAFIO ACEITO =====
async function handleChallengeAccepted(notification) {
    try {
        console.log('Processando desafio aceito:', notification);
        
        // 🔥 MOSTRAR NOTIFICAÇÃO INTERATIVA
        showChallengeAcceptedNotification(notification);
        
        // 🔥 TAMBÉM MOSTRAR NOTIFICAÇÃO SIMPLES DO SISTEMA
        showNotification(
            `🎯 ${notification.fromUserName} aceitou seu desafio! Clique para entrar na mesa.`,
            'success',
            () => {
                // Ao clicar na notificação, entrar na mesa
                joinChallengeTable(notification.tableId, notification.id);
            }
        );
        
    } catch (error) {
        console.error('❌ Erro ao processar desafio aceito:', error);
        showNotification('Erro ao processar desafio aceito', 'error');
    }
}


// ===== CRIAR MESA FALLBACK =====
async function createFallbackTable(challenge) {
    try {
        console.log('Tentando fallback para criação de mesa...');
        
        const tableName = `Desafio: ${challenge.fromUserName || 'Oponente'} vs ${userData.displayName}`;
        
        const boardData = convertBoardToFirestoreFormat(initializeBrazilianCheckersBoard());
        
        // Dados mínimos para a mesa
        const tableData = {
            name: tableName,
            timeLimit: 60,
            bet: 0,
            status: 'playing',
            players: [
                {
                    uid: challenge.fromUserId || 'unknown',
                    displayName: challenge.fromUserName || 'Desafiante',
                    rating: 1000,
                    color: 'black'
                },
                {
                    uid: currentUser.uid,
                    displayName: userData.displayName,
                    rating: userData.rating,
                    color: 'red'
                }
            ],
            createdBy: challenge.fromUserId || 'unknown',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            currentTurn: 'black',
            board: boardData,
            waitingForOpponent: false,
            platformFee: 0,
            isChallenge: true
        };
        
        const tableRef = await db.collection('tables').add(tableData);
        
        console.log('✅ Mesa fallback criada com ID:', tableRef.id);
        
        userActiveTable = tableRef.id;
        setupGameListener(tableRef.id);
        showScreen('game-screen');
        
        showNotification('Mesa criada! Boa sorte!', 'success');
        
    } catch (error) {
        console.error('❌ Erro no fallback:', error);
        showNotification('Erro crítico ao criar mesa', 'error');
    }
}

// ===== DEBUG: VERIFICAR DADOS DA NOTIFICAÇÃO =====
async function debugNotification(notificationId) {
    try {
        const doc = await db.collection('notifications').doc(notificationId).get();
        
        if (doc.exists) {
            const data = doc.data();
            console.log('📄 Dados da notificação:', {
                id: doc.id,
                fromUserId: data.fromUserId,
                fromUserName: data.fromUserName,
                toUserId: data.toUserId,
                timeLimit: data.timeLimit,
                betAmount: data.betAmount,
                status: data.status,
                hasChallengeId: !!data.challengeId
            });
        } else {
            console.log('❌ Notificação não encontrada');
        }
    } catch (error) {
        console.error('Erro no debug:', error);
    }
}

// Adicione ao window
window.debugNotif = debugNotification;

// ===== MARCAR NOTIFICAÇÃO COMO VISTA =====
async function markNotificationAsSeen(notificationId) {
    try {
        await db.collection('notifications').doc(notificationId).update({
            read: true,
            seenAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Erro ao marcar notificação como vista:', error);
    }
}

// ===== EFEITO DE PARTÍCULAS =====
function createParticleEffect(element) {
    const rect = element.getBoundingClientRect();
    const particles = 20;
    
    for (let i = 0; i < particles; i++) {
        const particle = document.createElement('div');
        particle.className = 'notification-particle';
        particle.style.width = Math.random() * 4 + 2 + 'px';
        particle.style.height = particle.style.width;
        particle.style.left = rect.left + rect.width / 2 + 'px';
        particle.style.top = rect.top + rect.height / 2 + 'px';
        
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 50 + 30;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        
        document.body.appendChild(particle);
        
        // Remover após animação
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        }, 1000);
    }
}

// ===== VERIFICAR DESAFIOS PENDENTES AO INICIAR =====
async function checkPendingChallenges() {
    if (!currentUser || !db) return;
    
    try {
        const snapshot = await db.collection('notifications')
            .where('toUserId', '==', currentUser.uid)
            .where('type', '==', 'challenge')
            .where('status', '==', 'pending')
            .where('expiresAt', '>', new Date())
            .orderBy('expiresAt', 'asc')
            .get();
        
        snapshot.forEach(doc => {
            const notification = { id: doc.id, ...doc.data() };
            showChallengeNotification(notification);
        });
        
    } catch (error) {
        console.error('Erro ao verificar desafios pendentes:', error);
    }
}



// ===== SISTEMA DE SONS =====
const gameSounds = {
    // Sons de movimento
    move: {
        url: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-piece-move-1564.mp3',
        volume: 0.3
    },
    capture: {
        url: 'https://assets.mixkit.co/sfx/preview/mixkit-arcade-game-jump-coin-216.mp3', 
        volume: 0.4
    },
    multipleCapture: {
        url: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
        volume: 0.5
    },
    
    // Sons de jogo
    kingPromotion: {
        url: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-arcade-notification-270.mp3',
        volume: 0.6
    },
    gameStart: {
        url: 'https://assets.mixkit.co/sfx/preview/mixkit-game-show-intro-331.mp3',
        volume: 0.5
    },
    gameEnd: {
        url: 'https://assets.mixkit.co/sfx/preview/mixkit-arcade-retro-game-over-213.mp3',
        volume: 0.5
    },
    victory: {
        url: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
        volume: 0.6
    },
    defeat: {
        url: 'https://assets.mixkit.co/sfx/preview/mixkit-arcade-retro-game-over-213.mp3',
        volume: 0.4
    },
    
    // Sons de interface
    click: {
        url: 'https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3',
        volume: 0.2
    },
    notification: {
        url: 'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3',
        volume: 0.3
    },
    challenge: {
        url: 'https://assets.mixkit.co/sfx/preview/mixkit-magic-sparkles-3001.mp3',
        volume: 0.4
    },
    
    // Música ambiente
    backgroundMusic: {
        url: 'https://assets.mixkit.co/music/preview/mixkit-strategic-chess-583.mp3',
        volume: 0.1,
        loop: true
    },
    intenseMusic: {
        url: 'https://assets.mixkit.co/music/preview/mixkit-game-show-suspense-waiting-667.mp3',
        volume: 0.15,
        loop: true
    }
};

// Cache de áudios
const audioCache = new Map();
let backgroundAudio = null;
let currentMusic = null;

// ===== SISTEMA DE SONS PROGRAMÁTICOS =====
class AudioManager {
    constructor() {
        this.enabled = true;
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.audioContext = null;
        this.init();
    }

    // Inicializar sistema de áudio
    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('✅ Sistema de áudio inicializado');
        } catch (error) {
            console.error('❌ Erro ao inicializar áudio:', error);
            this.enabled = false;
        }
        
        // Carregar preferências
        this.loadPreferences();
    }

    // Criar som programático
    createSound(frequency, duration, type = 'sine', volume = 0.3) {
        if (!this.enabled || !this.sfxEnabled || !this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + duration);
            
        } catch (error) {
            console.error('❌ Erro ao criar som:', error);
        }
    }

    // Sons específicos do jogo
    playMoveSound() {
        this.createSound(400, 0.1, 'sine', 0.2);
    }

    playCaptureSound() {
        this.createSound(800, 0.2, 'square', 0.4);
    }

    playMultipleCaptureSound() {
        this.createSound(1200, 0.3, 'sine', 0.5);
        setTimeout(() => this.createSound(1000, 0.2, 'sine', 0.4), 100);
    }

    playKingPromotionSound() {
        this.createSound(600, 0.1, 'sine', 0.4);
        setTimeout(() => this.createSound(800, 0.1, 'sine', 0.4), 100);
        setTimeout(() => this.createSound(1000, 0.2, 'sine', 0.5), 200);
    }

    playClickSound() {
        this.createSound(300, 0.05, 'sine', 0.2);
    }

    playNotificationSound() {
        this.createSound(500, 0.15, 'triangle', 0.3);
        setTimeout(() => this.createSound(600, 0.1, 'triangle', 0.2), 150);
    }

    playChallengeSound() {
        this.createSound(700, 0.1, 'sine', 0.4);
        setTimeout(() => this.createSound(900, 0.1, 'sine', 0.3), 100);
        setTimeout(() => this.createSound(1100, 0.2, 'sine', 0.4), 200);
    }

    playGameStartSound() {
        this.createSound(400, 0.1, 'sine', 0.3);
        setTimeout(() => this.createSound(600, 0.1, 'sine', 0.3), 100);
        setTimeout(() => this.createSound(800, 0.2, 'sine', 0.4), 200);
    }

    playVictorySound() {
        [400, 600, 800, 1000, 1200].forEach((freq, index) => {
            setTimeout(() => this.createSound(freq, 0.2, 'sine', 0.4), index * 100);
        });
    }

    playDefeatSound() {
        [600, 500, 400, 300].forEach((freq, index) => {
            setTimeout(() => this.createSound(freq, 0.3, 'sawtooth', 0.3), index * 150);
        });
    }

    // Música de fundo simples
    playBackgroundMusic() {
        if (!this.musicEnabled) return;
        
        // Música simples usando setInterval
        let noteIndex = 0;
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        
        this.musicInterval = setInterval(() => {
            if (this.musicEnabled) {
                this.createSound(notes[noteIndex % notes.length], 0.3, 'sine', 0.1);
                noteIndex++;
            }
        }, 500);
    }

    stopBackgroundMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
    }

    // Controles
    toggleSound(enabled) {
        this.sfxEnabled = enabled;
        localStorage.setItem('sfxEnabled', enabled);
    }

    toggleMusic(enabled) {
        this.musicEnabled = enabled;
        localStorage.setItem('musicEnabled', enabled);
        
        if (enabled) {
            this.playBackgroundMusic();
        } else {
            this.stopBackgroundMusic();
        }
    }

    loadPreferences() {
        const sfx = localStorage.getItem('sfxEnabled');
        const music = localStorage.getItem('musicEnabled');
        
        if (sfx !== null) this.sfxEnabled = sfx === 'true';
        if (music !== null) this.musicEnabled = music === 'true';
    }
}



function createSoundControls() {
    console.log('🔊 Criando controles de som...');
    // Implementação básica para evitar erros
    // No lugar onde você define o audioManager (provavelmente no topo do arquivo)
// ===== AUDIO MANAGER COMPLETO =====
let audioManager = {
    // Métodos de som
    playNotificationSound: function() {
        this.createSound(800, 0.3, 'sine', 0.1);
        console.log('🔊 Som de notificação');
    },
    
    playGameStartSound: function() {
        this.createSound(600, 0.5, 'sine', 0.2);
        console.log('🎮 Som de início de jogo');
    },
    
    playClickSound: function() {
        this.createSound(300, 0.1, 'sine', 0.1);
        console.log('🖱️ Som de clique');
    },
    
    playVictorySound: function() {
        this.createSound(800, 0.8, 'sine', 0.3);
        console.log('🎉 Som de vitória');
    },
    
    playDefeatSound: function() {
        this.createSound(400, 0.8, 'sine', 0.3);
        console.log('😞 Som de derrota');
    },
    
    playChallengeSound: function() {
        this.createSound(700, 0.4, 'sine', 0.25);
        console.log('🎯 Som de desafio');
    },
    
    playSelectionSound: function() {
        this.createSound(500, 0.2, 'sine', 0.15);
        console.log('🔘 Som de seleção');
    },
    
    // Método base para criar sons
    createSound: function(frequency, duration, type, volume) {
        try {
            // Verificar se o navegador suporta AudioContext
            if (!window.AudioContext && !window.webkitAudioContext) {
                console.log('Navegador não suporta AudioContext');
                return;
            }
            
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            
            oscillator.type = type || 'sine';
            oscillator.frequency.value = frequency || 440;
            gainNode.gain.value = volume || 0.1;
            
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (duration || 0.3));
            oscillator.stop(context.currentTime + (duration || 0.3));
            
        } catch (error) {
            console.log('Áudio não disponível:', error);
        }
    }
};

}


function updateSoundButtons() {
    const soundBtn = document.getElementById('btn-sound-toggle');
    const musicBtn = document.getElementById('btn-music-toggle');
    
    if (soundBtn) {
        soundBtn.classList.toggle('muted', !audioManager.sfxEnabled);
        soundBtn.innerHTML = audioManager.sfxEnabled ? 
            '<i class="fas fa-volume-up"></i>' : 
            '<i class="fas fa-volume-mute"></i>';
    }
    
    if (musicBtn) {
        musicBtn.classList.toggle('muted', !audioManager.musicEnabled);
        musicBtn.innerHTML = '<i class="fas fa-music"></i>';
    }
}



// ===== INTEGRAÇÃO DOS SONS NO JOGO =====

// Sons de movimento
function playMoveSound() {
    audioManager.playSound('move');
}

function playCaptureSound(isMultiple = false) {
    audioManager.playSound(isMultiple ? 'multipleCapture' : 'capture');
}

function playKingPromotionSound() {
    audioManager.playSound('kingPromotion');
}

// Sons de jogo
function playGameStartSound() {
    audioManager.playSound('gameStart');
    audioManager.playMusic('backgroundMusic');
}

function playGameEndSound(win = true) {
    audioManager.playSound(win ? 'victory' : 'defeat');
    audioManager.stopMusic();
}

function playIntenseMusic() {
    audioManager.playMusic('intenseMusic');
}

// Sons de interface
function playClickSound() {
    audioManager.playSound('click');
}

function playNotificationSound() {
    audioManager.playSound('notification');
}

function playChallengeSound() {
    audioManager.playSound('challenge');
}

// ===== INTEGRAÇÃO SIMPLIFICADA =====
function initializeGameWithSound() {
    console.log('🔊 Inicializando sistema de som...');
    
    // Sons de movimento - modificar makeMove diretamente
    const originalMakeMove = makeMove;
    makeMove = async function(fromRow, fromCol, toRow, toCol, captures) {
        const result = await originalMakeMove.call(this, fromRow, fromCol, toRow, toCol, captures);
        
        // Tocar som apropriado
        if (captures && captures.length > 0) {
            if (captures.length > 1) {
                audioManager.playMultipleCaptureSound();
            } else {
                audioManager.playCaptureSound();
            }
        } else {
            audioManager.playMoveSound();
        }
        
        return result;
    };

    // Verificar promoção a dama - adicionar à makeMove ou criar função separada
    const gameStateHandler = {
        set: function(target, property, value) {
            target[property] = value;
            
            // Verificar se uma peça foi promovida a dama
            if (property === 'board' && value) {
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        const piece = value[row] && value[row][col];
                        if (piece && piece.king && 
                            !(target[property][row] && target[property][row][col] && target[property][row][col].king)) {
                            audioManager.playKingPromotionSound();
                        }
                    }
                }
            }
            return true;
        }
    };
    
    // Aplicar handler se gameState existir
    if (gameState) {
        gameState = new Proxy(gameState, gameStateHandler);
    }
}

// Configuração simples de WebRTC
class VoiceChat {
    constructor() {
        this.localStream = null;
        this.peerConnection = null;
        this.isAudioActive = false;
    }

    async initVoiceChat() {
        try {
            // Solicitar permissão de microfone
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
            
            this.setupUI();
            console.log('Microfone ativado com sucesso!');
            
        } catch (error) {
            console.error('Erro ao acessar microfone:', error);
            this.showError('Não foi possível acessar o microfone');
        }
    }

    setupUI() {
        const toggleBtn = document.getElementById('voice-toggle');
        const statusDiv = document.getElementById('voice-status');

        toggleBtn.addEventListener('click', () => {
            this.isAudioActive = !this.isAudioActive;
            
            if (this.isAudioActive) {
                this.startVoiceChat();
                toggleBtn.style.background = '#2ecc71';
                toggleBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                statusDiv.style.display = 'block';
            } else {
                this.stopVoiceChat();
                toggleBtn.style.background = '#e74c3c';
                toggleBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                statusDiv.style.display = 'none';
            }
        });

        // Visualização de áudio (opcional)
        this.createAudioVisualizer();
    }

    async startVoiceChat() {
        // Aqui você conectaria com o oponente via WebRTC
        console.log('Voice chat iniciado');
        this.showNotification('Chat de voz ativado');
    }

    stopVoiceChat() {
        console.log('Voice chat parado');
        this.showNotification('Chat de voz desativado');
    }

    createAudioVisualizer() {
        // Implementação simples de visualizador de áudio
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(this.localStream);
        
        source.connect(analyser);
        // ... código do visualizador
    }

    showNotification(message) {
        // Usar seu sistema de notificação existente
        if (typeof showNotification === 'function') {
            showNotification(message, 'info');
        }
    }

    showError(message) {
        if (typeof showNotification === 'function') {
            showNotification(message, 'error');
        }
    }
}

// Inicializar quando o jogo começar
const voiceChat = new VoiceChat();

// Iniciar quando o jogo começar
function startGameVoiceChat() {
    voiceChat.initVoiceChat();
}

// Parar quando o jogo terminar
function stopGameVoiceChat() {
    voiceChat.stopVoiceChat();
}

// ===== INICIALIZAR VOICE CHAT =====
async function initializeGameVoiceChat() {
    if (voiceChatSystem) {
        console.log('⚠️ Sistema de voz já inicializado');
        return;
    }
    
    if (!gameState || !gameState.players || gameState.players.length < 2) {
        console.log('⚠️ Jogo não está pronto para voice chat');
        return;
    }
    
    console.log('🎮 Inicializando voice chat...');
    
    voiceChatSystem = new VoiceChatSystem();
    const success = await voiceChatSystem.initialize();
    
    if (success) {
        console.log('✅ Voice chat pronto para uso');
        // Mostrar instruções após um delay
        setTimeout(() => {
            voiceChatSystem.showNotification('💬 Clique no ícone de microfone no canto inferior direito para falar', 'info', 5000);
        }, 2000);
    }
}

function cleanupGameVoiceChat() {
    if (voiceChatSystem.isEnabled) {
        stopVoiceChat();
        
        const voiceToggle = document.getElementById('voice-toggle');
        if (voiceToggle) {
            voiceToggle.classList.remove('active');
            voiceToggle.innerHTML = '<i class="fas fa-microphone-slash"></i> Voz';
        }
        
        voiceChatSystem.isEnabled = false;
    }
}

// ===== VERIFICAR SE É MOBILE =====
function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// ===== CLASSE VoiceChatSystem (SIMPIFICADA) =====
class VoiceChatSystem {
    constructor() {
        this.localStream = null;
        this.isAudioActive = false;
        this.hasAudioPermission = false;
    }

    async initialize() {
        console.log('🎤 Inicializando sistema de voz...');
        
        try {
            // Verificar suporte do navegador
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.showError('Seu navegador não suporta chat de voz');
                return false;
            }

            // Solicitar permissão de microfone
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });

            this.hasAudioPermission = true;
            this.createUI();
            this.setupEventListeners();
            
            console.log('✅ Sistema de voz inicializado com sucesso');
            return true;

        } catch (error) {
            console.error('❌ Erro ao inicializar voz:', error);
            this.handlePermissionError(error);
            return false;
        }
    }

    handlePermissionError(error) {
        let errorMessage = 'Não foi possível acessar o microfone';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Permissão de microfone negada. Clique no ícone de cadeado na barra de URL para permitir.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'Nenhum microfone encontrado';
        } else if (error.name === 'NotReadableError') {
            errorMessage = 'Microfone está sendo usado por outra aplicação';
        }
        
        this.showError(errorMessage);
    }

    createUI() {
        // Verificar se a UI já existe
        if (document.getElementById('voice-chat-container')) {
            return;
        }

        const voiceChatHTML = `
            <div id="voice-chat-container" style="position: fixed; bottom: 20px; right: 20px; z-index: 1000;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; background: rgba(0,0,0,0.8); padding: 15px; border-radius: 20px;">
                    <button id="voice-toggle" style="background: #e74c3c; color: white; border: none; padding: 15px; border-radius: 50%; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
                        <i class="fas fa-microphone"></i>
                    </button>
                    
                    <div id="voice-status" style="color: white; padding: 8px 12px; border-radius: 15px; font-size: 12px; text-align: center;">
                        <div>Clique para falar</div>
                        <div id="connection-status" style="font-size: 10px; opacity: 0.7; margin-top: 5px;">Pronto</div>
                    </div>
                    
                    <div id="audio-visualizer" style="width: 100px; height: 20px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden;">
                        <div id="audio-level" style="height: 100%; width: 0%; background: linear-gradient(90deg, #2ecc71, #f1c40f); transition: width 0.1s;"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', voiceChatHTML);
    }

    setupEventListeners() {
        const toggleBtn = document.getElementById('voice-toggle');
        const statusDiv = document.getElementById('voice-status');
        const connectionStatus = document.getElementById('connection-status');

        if (!toggleBtn) return;

        toggleBtn.addEventListener('click', () => {
            this.toggleVoiceChat();
        });

        // Iniciar visualizador de áudio
        this.setupAudioVisualizer();
    }

    toggleVoiceChat() {
        const toggleBtn = document.getElementById('voice-toggle');
        const statusDiv = document.getElementById('voice-status');
        const connectionStatus = document.getElementById('connection-status');

        this.isAudioActive = !this.isAudioActive;
        
        if (this.isAudioActive) {
            this.startVoice();
            toggleBtn.style.background = '#2ecc71';
            toggleBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            statusDiv.innerHTML = '<div>Microfone ativo</div>';
            connectionStatus.textContent = 'Falando...';
            connectionStatus.style.color = '#2ecc71';
        } else {
            this.stopVoice();
            toggleBtn.style.background = '#e74c3c';
            toggleBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            statusDiv.innerHTML = '<div>Clique para falar</div>';
            connectionStatus.textContent = 'Pronto';
            connectionStatus.style.color = '';
        }
    }

    startVoice() {
        console.log('🎤 Microfone ativado');
        this.showNotification('Microfone ativado - Você está sendo ouvido', 'info');
        
        // Aqui você pode adicionar lógica para enviar áudio para o oponente
        // quando implementar WebRTC completo
    }

    stopVoice() {
        console.log('🎤 Microfone desativado');
        this.showNotification('Microfone desativado', 'info');
    }

    setupAudioVisualizer() {
        if (!this.localStream || !this.hasAudioPermission) return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(this.localStream);
            
            source.connect(analyser);
            analyser.fftSize = 256;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const visualizer = document.getElementById('audio-level');

            const updateVisualizer = () => {
                analyser.getByteFrequencyData(dataArray);
                
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                
                const average = sum / dataArray.length;
                const width = Math.min(100, average * 0.5);
                
                if (visualizer) {
                    visualizer.style.width = width + '%';
                }
                
                if (this.isAudioActive) {
                    requestAnimationFrame(updateVisualizer);
                }
            };

            updateVisualizer();

        } catch (error) {
            console.log('Visualizador de áudio não disponível:', error);
        }
    }

    showNotification(message, type = 'info') {
        // Use seu sistema de notificação existente
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            // Fallback simples
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    // Função para limpar (importante!)
    cleanup() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        this.isAudioActive = false;
        this.hasAudioPermission = false;
        
        // Remover UI se existir
        const voiceContainer = document.getElementById('voice-chat-container');
        if (voiceContainer) {
            voiceContainer.remove();
        }
        
        console.log('🧹 Sistema de voz limpo');
    }
}


