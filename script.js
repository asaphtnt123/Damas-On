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

// ===== VARIÁVEIS GLOBAIS =====
let currentUser = null;
let userData = null;
let gameState = null;
let selectedPiece = null;
let currentGameRef = null;
let gameListener = null;
let tablesListener = null;

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

// Chame esta função no final do initializeApp()
function initializeApp() {
  initializeAuth();
  initializeUI();
  initializeRegisterForm();
  initializeGame();
  
  // Verificar elementos (apenas para debug)
  checkRequiredElements();
}
// ===== AUTENTICAÇÃO =====
function initializeAuth() {
  console.log('Inicializando autenticação...');
  
  // Observador de estado de autenticação
  auth.onAuthStateChanged((user) => {
    console.log('Estado de autenticação alterado:', user);
    if (user) {
      currentUser = user;
      loadUserData(user.uid);
      showScreen('main-screen');
      loadTables();
      loadRanking();
      loadFriends();
    } else {
      currentUser = null;
      userData = null;
      showScreen('auth-screen');
    }
  });

  // Verificar se os elementos existem antes de adicionar event listeners
  const loginBtn = document.getElementById('btn-login');
  const registerBtn = document.getElementById('btn-register');
  const googleBtn = document.getElementById('btn-google');
  const logoutBtn = document.getElementById('btn-logout');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  
  // Adicionar event listeners apenas se os elementos existirem
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

async function signIn() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    showNotification('Por favor, preencha todos os campos', 'error');
    return;
  }
  
  try {
    showLoading(true);
    await auth.signInWithEmailAndPassword(email, password);
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
    await auth.signInWithPopup(provider);
    showNotification('Login com Google realizado!', 'success');
  } catch (error) {
    showNotification('Erro ao fazer login com Google: ' + error.message, 'error');
    showLoading(false);
  }
}

async function signOut() {
  try {
    await auth.signOut();
    showNotification('Logout realizado com sucesso', 'info');
  } catch (error) {
    showNotification('Erro ao fazer logout', 'error');
  }
}

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

function showNotification(message, type = 'info') {
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
  
  // Remover após 5 segundos
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 500);
  }, 5000);
}

function removeExistingNotifications() {
  const notifications = document.querySelectorAll('.notification');
  notifications.forEach(notification => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  });
}

// ===== GERENCIAMENTO DE USUÁRIO =====
async function loadUserData(uid) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      userData = { id: uid, ...userDoc.data() };
      updateUIWithUserData();
    } else {
      console.error('Documento do usuário não encontrado');
    }
  } catch (error) {
    console.error('Erro ao carregar dados do usuário:', error);
  }
}

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

// ===== VERIFICAÇÃO EXTRA NA CRIAÇÃO DA MESA =====
async function createNewTable() {
    console.log('CRIANDO NOVA MESA - Inicializando tabuleiro...');
  const boardData = convertBoardToFirestoreFormat(initializeBrazilianCheckersBoard());
  
  const tableName = document.getElementById('table-name').value || `Mesa de ${userData.displayName}`;
  const timeLimit = parseInt(document.getElementById('table-time').value);
  const bet = parseInt(document.getElementById('table-bet').value) || 0;
  
  if (bet > 0 && userData.coins < bet) {
    showNotification('Você não tem moedas suficientes para esta aposta', 'error');
    return;
  }
  
  try {
    // Inicializar e verificar tabuleiro
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
        color: 'black' // Jogador 1 = PRETAS (começam no topo)
      }],
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      currentTurn: 'black', // Pretas começam
      board: boardData,
      waitingForOpponent: true
    });
    
    if (bet > 0) {
      await db.collection('users').doc(currentUser.uid).update({
        coins: firebase.firestore.FieldValue.increment(-bet)
      });
      userData.coins -= bet;
    }
    
    closeAllModals();
    showNotification('Mesa criada com sucesso!', 'success');
    
    // Entrar na mesa
    setupGameListener(tableRef.id);
    showScreen('game-screen');
    showNotification('Aguardando adversário...', 'info');
    
  } catch (error) {
    console.error('Erro ao criar mesa:', error);
    showNotification('Erro ao criar mesa: ' + error.message, 'error');
  }
}

// ===== CORRIGIR JOIN TABLE =====
async function joinTable(tableId) {
  try {
    const tableRef = db.collection('tables').doc(tableId);
    const tableDoc = await tableRef.get();
    
    if (!tableDoc.exists) {
      showNotification('Mesa não encontrada', 'error');
      return;
    }
    
    const table = tableDoc.data();
    
    // Se usuário já está na mesa, apenas entrar
    if (table.players.some(p => p.uid === currentUser.uid)) {
      setupGameListener(tableId);
      showScreen('game-screen');
      
      if (table.players.length === 1) {
        showNotification('Aguardando adversário...', 'info');
      } else {
        showNotification('Jogo em andamento', 'info');
      }
      return;
    }
    
    // Verificar se mesa está cheia
    if (table.players.length >= 2) {
      showNotification('Esta mesa já está cheia', 'error');
      return;
    }
    
    // Verificar aposta
    if (table.bet > 0 && userData.coins < table.bet) {
      showNotification('Você não tem moedas suficientes para entrar nesta mesa', 'error');
      return;
    }
    
    // CORREÇÃO: Segundo jogador é VERMELHO (base)
    await tableRef.update({
      players: firebase.firestore.FieldValue.arrayUnion({
        uid: currentUser.uid,
        displayName: userData.displayName,
        rating: userData.rating,
        color: 'red' // Segundo jogador é vermelho
      }),
      status: 'playing',
      waitingForOpponent: false
    });
    
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
    
  } catch (error) {
    showNotification('Erro ao entrar na mesa: ' + error.message, 'error');
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
// ===== ATUALIZAR SETUP SPECTATORS LISTENER =====
function setupSpectatorsListener(tableId) {
    if (spectatorsListener) spectatorsListener();
    
    spectatorsListener = db.collection('tables')
        .doc(tableId)
        .collection('spectators')
        .onSnapshot((snapshot) => {
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
        });
}

// ===== ATUALIZAR UPDATE SPECTATORS UI PARA JOGADORES =====
function updateSpectatorsUI() {
    const spectatorsContainer = document.getElementById('spectators-container');
    const supportersContainer = document.getElementById('supporters-container');
    const spectatorsCountBadge = document.querySelector('.spectators-count-badge');
    
    if (!spectatorsContainer || !supportersContainer) return;
    
    // Atualizar contador
    if (spectatorsCountBadge) {
        spectatorsCountBadge.innerHTML = `<i class="fas fa-eye"></i> ${currentSpectators.length}`;
    }
    
    // Lista de espectadores
    spectatorsContainer.innerHTML = `
        <div class="spectators-list">
            ${currentSpectators.map(spec => `
                <div class="spectator-item">
                    <i class="fas fa-user"></i>
                    <span class="spectator-name">${spec.displayName}</span>
                    ${spec.supporting ? `
                        <span class="supporting-badge" style="background: ${spec.supporting === 'black' ? '#000' : '#e74c3c'}">
                            <i class="fas fa-flag"></i> Torcendo
                        </span>
                    ` : ''}
                </div>
            `).join('')}
            ${currentSpectators.length === 0 ? '<div class="no-spectators">Nenhum espectador</div>' : ''}
        </div>
    `;
    
    // Lista de torcedores por jogador
    const blackSupporters = currentSpectators.filter(s => s.supporting === 'black');
    const redSupporters = currentSpectators.filter(s => s.supporting === 'red');
    
    supportersContainer.innerHTML = `
        <div class="supporters-section">
            <h5 class="supporters-title" style="color: #000;">
                <i class="fas fa-chess-pawn"></i> Pretas (${blackSupporters.length})
            </h5>
            <div class="supporters-list">
                ${blackSupporters.map(s => `
                    <div class="supporter-item">
                        <i class="fas fa-user"></i> ${s.displayName}
                    </div>
                `).join('')}
                ${blackSupporters.length === 0 ? '<div class="no-supporters">Ninguém torcendo</div>' : ''}
            </div>
        </div>
        
        <div class="supporters-section">
            <h5 class="supporters-title" style="color: #e74c3c;">
                <i class="fas fa-chess-pawn"></i> Vermelhas (${redSupporters.length})
            </h5>
            <div class="supporters-list">
                ${redSupporters.map(s => `
                    <div class="supporter-item">
                        <i class="fas fa-user"></i> ${s.displayName}
                    </div>
                `).join('')}
                ${redSupporters.length === 0 ? '<div class="no-supporters">Ninguém torcendo</div>' : ''}
            </div>
        </div>
    `;
    
    // Mostrar notificação para jogadores quando alguém torce por eles
    const isPlayer = gameState.players.some(p => p.uid === currentUser.uid);
    if (isPlayer) {
        const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
        const newSupporters = currentSpectators.filter(s => 
            s.supporting === currentPlayer.color && 
            !currentSpectators.some(oldSpec => oldSpec.id === s.id && oldSpec.supporting === currentPlayer.color)
        );
        
        newSupporters.forEach(supporter => {
            showNotification(`${supporter.displayName} está torcendo por você! 🎉`, 'success', 3000);
        });
    }
}


// ===== FUNÇÃO UPDATE RENDER TABLE PARA ESPECTADORES =====
function renderTable(table, container) {
    const tableEl = document.createElement('div');
    tableEl.className = 'table-item';
    tableEl.dataset.tableId = table.id;
    
    const playerCount = table.players ? table.players.length : 0;
    const isPlaying = table.status === 'playing';
    const isFinished = table.status === 'finished';
    const isDraw = table.status === 'draw';
    const isWaiting = table.status === 'waiting';
    
    let tableStatus = '';
    let actionButton = '';
    
    if (isFinished || isDraw) {
        const resultClass = isDraw ? 'draw-result' : 'win-result';
        tableStatus = `<div class="table-result ${resultClass}">${table.resultText || (isDraw ? 'Empate' : 'Jogo finalizado')}</div>`;
        actionButton = `<button class="btn btn-secondary btn-small" disabled>Finalizado</button>`;
    } else if (isPlaying) {
        tableStatus = `
            <div class="table-status">Jogando</div>
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
                    <i class="fas fa-eye"></i> Assistir
                </button>
            `;
        }
    } else if (isWaiting) {
        tableStatus = `<div class="table-status waiting">Aguardando jogador</div>`;
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



// ===== VARIÁVEIS GLOBAIS PARA CAPTURAS =====
let hasGlobalMandatoryCaptures = false;
let capturingPieces = [];

// ===== FUNÇÃO CHECK GLOBAL MANDATORY CAPTURES (MELHORADA) =====
function checkGlobalMandatoryCaptures() {
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



// ===== DEBUG: FUNÇÃO TEMPORÁRIA PARA VER TABULEIRO =====
function debugShowBoard() {
  if (gameState && gameState.board) {
    console.log('=== TABULEIRO ATUAL (DEBUG) ===');
    for (let row = 0; row < 8; row++) {
      let rowStr = `${row}: `;
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col];
        if (piece) {
          rowStr += piece.color === 'black' ? 'B ' : 'R ';
        } else {
          rowStr += (row + col) % 2 !== 0 ? '_ ' : 'X ';
        }
      }
      console.log(rowStr);
    }
  }
}
// ===== FUNÇÃO HANDLE CELL CLICK (VERIFICAÇÃO FINAL) =====
function handleCellClick(row, col) {
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

// ===== FUNÇÃO HANDLE PIECE CLICK (COM VERIFICAÇÃO DE CAPTURA) =====
function handlePieceClick(row, col) {
    const piece = gameState.board[row][col];
    if (!piece || piece.color !== gameState.currentTurn) return;
    
    // Verificar capturas obrigatórias
    if (hasGlobalMandatoryCaptures) {
        // Verificar se esta peça específica pode capturar
        const canThisPieceCapture = capturingPieces.some(p => p.row === row && p.col === col);
        
        if (!canThisPieceCapture) {
            showNotification('Você deve selecionar uma peça que possa capturar!', 'error');
            return;
        }
    }
    
    // Selecionar peça
    clearSelection();
    selectedPiece = { row, col };
    
    const pieceEl = document.querySelector(`.checker-piece[data-row="${row}"][data-col="${col}"]`);
    if (pieceEl) {
        pieceEl.classList.add('selected');
        showPossibleMoves(row, col);
    }
}
// ===== FUNÇÃO SHOW POSSIBLE MOVES (INDICAÇÃO CLARA DE CAPTURAS) =====
function showPossibleMoves(row, col) {
    clearHighlights();
    
    const moves = getPossibleMoves(row, col);
    
    moves.forEach(move => {
        const cell = document.querySelector(`.board-cell[data-row="${move.toRow}"][data-col="${move.toCol}"]`);
        if (cell) {
            if (move.captures && move.captures.length > 0) {
                cell.classList.add('capture-highlight');
                cell.title = `Captura ${move.captures.length} peça(s)`;
            } else {
                cell.classList.add('highlighted');
            }
        }
        
        // Destacar peças que serão capturadas
        if (move.captures) {
            move.captures.forEach(capture => {
                const pieceEl = document.querySelector(`.checker-piece[data-row="${capture.row}"][data-col="${capture.col}"]`);
                if (pieceEl) {
                    pieceEl.classList.add('capture-target');
                }
            });
        }
    });
}


// ===== FUNÇÃO CLEAR HIGHLIGHTS =====
function clearHighlights() {
  document.querySelectorAll('.board-cell.highlighted').forEach(cell => {
    cell.classList.remove('highlighted');
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

// ===== FUNÇÃO UPDATE PLAYER INFO =====
function updatePlayerInfo() {
  if (!gameState || !gameState.players) return;
  
  const opponent = gameState.players.find(p => p.uid !== currentUser.uid);
  const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
  
  if (opponent) {
    const opponentNameEl = document.querySelector('.opponent-info .player-name');
    const opponentRatingEl = document.querySelector('.opponent-info .player-rating');
    const opponentAvatarEl = document.querySelector('.opponent-info .player-avatar img');
    
    if (opponentNameEl) opponentNameEl.textContent = opponent.displayName;
    if (opponentRatingEl) opponentRatingEl.textContent = opponent.rating;
    if (opponentAvatarEl) {
      opponentAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(opponent.displayName)}&background=random`;
    }
  }
  
  if (currentPlayer) {
    const playerNameEl = document.querySelector('.my-info .player-name');
    const playerRatingEl = document.querySelector('.my-info .player-rating');
    const playerAvatarEl = document.querySelector('.my-info .player-avatar img');
    
    if (playerNameEl) playerNameEl.textContent = currentPlayer.displayName;
    if (playerRatingEl) playerRatingEl.textContent = currentPlayer.rating;
    if (playerAvatarEl) {
      playerAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentPlayer.displayName)}&background=random`;
    }
  }
}

// ===== FUNÇÃO SURRENDER GAME =====
async function surrenderGame() {
  console.log('Iniciando processo de desistência...');
  
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
    
    // Calcular recompensas
    const betAmount = gameState.bet || 0;
    const reward = betAmount * 2; // O vencedor recebe o dobro da aposta
    
    // Atualizar estatísticas dos jogadores
    const winningPlayer = gameState.players.find(p => p.color === winner);
    const losingPlayer = currentPlayer;
    
    if (winningPlayer) {
      await db.collection('users').doc(winningPlayer.uid).update({
        wins: firebase.firestore.FieldValue.increment(1),
        rating: firebase.firestore.FieldValue.increment(10), // Menos pontos por desistência
        coins: firebase.firestore.FieldValue.increment(reward)
      });
    }
    
    if (losingPlayer) {
      await db.collection('users').doc(losingPlayer.uid).update({
        losses: firebase.firestore.FieldValue.increment(1),
        rating: firebase.firestore.FieldValue.increment(-15) // Mais penalidade por desistir
      });
    }
    
    // Atualizar estado do jogo
    await currentGameRef.update({
      status: 'finished',
      winner: winner,
      finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      surrendered: true,
      surrenderedBy: currentUser.uid
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

// ===== FUNÇÃO OFFER DRAW (COMPLETA) =====
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
            const confirm = await showConfirmModal(
                'Proposta de Empate', 
                `${gameState.drawOffer.senderName} ofereceu empate. Aceitar?`
            );
            
            if (confirm) {
                await endGame('draw');
                // Limpar a oferta de empate
                await currentGameRef.update({
                    drawOffer: null
                });
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

// ===== FUNÇÃO END GAME (ATUALIZADA PARA EMPATE) =====
async function endGame(result) {
    try {
        if (!currentGameRef || !gameState || !gameState.players) {
            console.error('Referências inválidas em endGame');
            return;
        }
        
        const tableId = currentGameRef.id;
        let winner = null;
        let status = 'finished';
        let resultText = '';
        
        if (result === 'draw') {
            status = 'draw';
            resultText = 'Empate';
            
            // Atualizar estatísticas para empate
            for (const player of gameState.players) {
                await db.collection('users').doc(player.uid).update({
                    draws: firebase.firestore.FieldValue.increment(1),
                    rating: firebase.firestore.FieldValue.increment(5)
                });
            }
            
            showNotification('Jogo terminou em empate!', 'info');
            
        } else {
            winner = result;
            status = 'finished';
            const winningPlayer = gameState.players.find(p => p.color === winner);
            const losingPlayer = gameState.players.find(p => p.color !== winner);
            
            resultText = winningPlayer ? `Vitória de ${winningPlayer.displayName}` : `Vitória das ${winner === 'black' ? 'pretas' : 'vermelhas'}`;
            
            // Calcular recompensa
            const reward = gameState.bet ? gameState.bet * 2 : 0;
            
            if (winningPlayer) {
                await db.collection('users').doc(winningPlayer.uid).update({
                    wins: firebase.firestore.FieldValue.increment(1),
                    rating: firebase.firestore.FieldValue.increment(20),
                    coins: firebase.firestore.FieldValue.increment(reward)
                });
            }
            
            if (losingPlayer) {
                await db.collection('users').doc(losingPlayer.uid).update({
                    losses: firebase.firestore.FieldValue.increment(1),
                    rating: firebase.firestore.FieldValue.increment(-10)
                });
            }
            
            // Mostrar resultado
            const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
            if (currentPlayer && currentPlayer.color === winner) {
                showNotification('Você venceu! +' + reward + ' moedas', 'success');
            } else {
                showNotification('Você perdeu!', 'error');
            }
        }
        
        // Atualizar estado do jogo com informações do resultado
        await currentGameRef.update({
            status: status,
            winner: winner,
            resultText: resultText,
            finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
            finalBoard: convertBoardToFirestoreFormat(gameState.board),
            drawOffer: null // Limpar qualquer oferta de empate pendente
        });
        
        // Atualizar a lista de mesas para mostrar o resultado
        updateTablesList();
        
        // Voltar para o lobby após 3 segundos
        setTimeout(() => {
            leaveGame();
        }, 3000);
        
    } catch (error) {
        console.error('Erro ao finalizar jogo:', error);
        showNotification('Erro ao finalizar jogo: ' + error.message, 'error');
    }
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

// ===== FUNÇÃO GET POSSIBLE MOVES (REGRA OFICIAL) =====
function getPossibleMoves(fromRow, fromCol) {
    if (!gameState || !gameState.board) return [];
    
    const piece = gameState.board[fromRow][fromCol];
    if (!piece) return [];
    
    // 1. Verificar capturas obrigatórias primeiro
    const captures = getCaptureMoves(fromRow, fromCol, piece, []);
    if (captures.length > 0) {
        return captures;
    }
    
    // 2. Se não houver capturas, verificar movimentos normais
    const moves = [];
    const directions = [];
    
    if (piece.king) {
        directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    } else {
        const direction = piece.color === 'red' ? -1 : 1;
        directions.push([direction, -1], [direction, 1]);
    }
    
    for (const [rowDir, colDir] of directions) {
        const toRow = fromRow + rowDir;
        const toCol = fromCol + colDir;
        
        if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) continue;
        
        if (gameState.board[toRow][toCol] === null && (toRow + toCol) % 2 !== 0) {
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

// ===== AMIGOS =====
async function loadFriends() {
  const friendsContainer = document.getElementById('friends-container');
  if (friendsContainer) {
    friendsContainer.innerHTML = '<p class="text-center">Funcionalidade de amigos em desenvolvimento</p>';
  }
}

// ===== FUNÇÃO CHECK GAME END (CORRIGIDA) =====
function checkGameEnd(board, currentTurn) {
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
    if (redPieces === 0 || !redCanMove) {
        if (currentGameRef) {
            endGame('black');
        }
    } else if (blackPieces === 0 || !blackCanMove) {
        if (currentGameRef) {
            endGame('red');
        }
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

// ===== FUNÇÃO UPDATE TURN INFO (ADICIONE ESTA FUNÇÃO) =====
function updateTurnInfo() {
    if (!gameState) return;
    
    const turnInfo = document.getElementById('turn-info');
    if (!turnInfo) return;
    
    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
    const isMyTurn = currentPlayer && currentPlayer.color === gameState.currentTurn;
    
    if (isMyTurn) {
        turnInfo.textContent = 'Sua vez de jogar!';
        turnInfo.className = 'turn-indicator my-turn';
    } else {
        const opponent = gameState.players.find(p => p.uid !== currentUser.uid);
        turnInfo.textContent = opponent ? `Vez de ${opponent.displayName}` : 'Vez do adversário';
        turnInfo.className = 'turn-indicator opponent-turn';
    }
}

// ===== FUNÇÃO MAKE MOVE (DEBUG ADICIONAL PARA DAMAS) =====
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
        if (captures && captures.length > 0) {
            captures.forEach(capture => {
                newBoard[capture.row][capture.col] = null;
                capturedPieces++;
            });
        }
        
        // Verificar promoção a dama
        if ((movingPiece.color === 'red' && toRow === 0) || 
            (movingPiece.color === 'black' && toRow === 7)) {
            newBoard[toRow][toCol].king = true;
            console.log('Peça promovida a dama!');
        }
        
        // DEBUG: Informações da peça
        console.log('Peça movida:', movingPiece);
        console.log('É dama?', movingPiece.king);
        console.log('Capturas realizadas:', capturedPieces);
        
        // Verificar capturas adicionais NO TABULEIRO ATUALIZADO
        const moreCaptures = getCaptureMoves(toRow, toCol, newBoard[toRow][toCol], []);
        console.log('Mais capturas possíveis:', moreCaptures.length);
        
        // REGRA IMPORTANTE: Para damas, só continuar se houver capturas adicionais
        // que sejam na mesma jogada (captura múltipla)
        const shouldContinue = capturedPieces > 0 && moreCaptures.length > 0;
        
        console.log('Continuar jogada?', shouldContinue);
        
        if (shouldContinue) {
            console.log('CONTINUAR CAPTURA MÚLTIPLA');
            
            const firestoreBoard = convertBoardToFirestoreFormat(newBoard);
            await currentGameRef.update({
                board: firestoreBoard,
                lastMove: {
                    fromRow, fromCol, toRow, toCol, captures
                }
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
            console.log('PASSAR TURNO');
            
            // PASSAR TURNO
            const nextTurn = gameState.currentTurn === 'red' ? 'black' : 'red';
            
            const firestoreBoard = convertBoardToFirestoreFormat(newBoard);
            await currentGameRef.update({
                board: firestoreBoard,
                currentTurn: nextTurn,
                lastMove: {
                    fromRow, fromCol, toRow, toCol, captures
                }
            });
            
            gameState.board = newBoard;
            gameState.currentTurn = nextTurn;
            
            console.log('Turno passado para:', nextTurn);
            checkGameEnd(newBoard, nextTurn);
            clearSelection();
        }
        
    } catch (error) {
        console.error('Erro ao realizar movimento:', error);
        showNotification('Erro ao realizar movimento: ' + error.message, 'error');
    }
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
// ===== FUNÇÃO GET CAPTURE MOVES (DEBUG ADICIONAL) =====
function getCaptureMoves(fromRow, fromCol, piece, currentCaptures = []) {
    console.log('Verificando capturas para peça em:', fromRow, fromCol, piece);
    
    const captures = [];
    
    if (piece.king) {
        console.log('É uma dama - verificando capturas longas');
        captures.push(...getKingCaptureMoves(fromRow, fromCol, piece, currentCaptures));
    } else {
        console.log('É uma peça normal - verificando capturas');
        captures.push(...getNormalPieceCaptureMoves(fromRow, fromCol, piece, currentCaptures));
    }
    
    console.log('Capturas encontradas:', captures.length);
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


function getKingCaptureMoves(fromRow, fromCol, piece, currentCaptures = []) {
    const captures = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    for (const [rowDir, colDir] of directions) {
        let foundEnemy = false;
        let enemyPosition = null;
        
        // Procurar por uma peça inimiga nesta direção
        for (let distance = 1; distance <= 7; distance++) {
            const checkRow = fromRow + (rowDir * distance);
            const checkCol = fromCol + (colDir * distance);
            
            if (checkRow < 0 || checkRow > 7 || checkCol < 0 || checkCol > 7) break;
            
            const checkCell = gameState.board[checkRow][checkCol];
            
            if (!foundEnemy) {
                if (checkCell) {
                    if (checkCell.color !== piece.color) {
                        // Encontrou peça inimiga
                        foundEnemy = true;
                        enemyPosition = { row: checkRow, col: checkCol };
                        
                        // Verificar se já foi capturada
                        const alreadyCaptured = currentCaptures.some(c => 
                            c.row === checkRow && c.col === checkCol
                        );
                        
                        if (alreadyCaptured) {
                            foundEnemy = false;
                            break;
                        }
                    } else {
                        // Peça aliada - não pode pular
                        break;
                    }
                }
            } else {
                // Já encontrou inimigo, procurar casa vazia para pousar
                if (checkCell === null) {
                    // Casa vazia encontrada - captura válida
                    const newCapture = { 
                        row: enemyPosition.row, 
                        col: enemyPosition.col 
                    };
                    const allCaptures = [...currentCaptures, newCapture];
                    
                    const captureMove = {
                        fromRow,
                        fromCol,
                        toRow: checkRow,
                        toCol: checkCol,
                        captures: allCaptures
                    };
                    
                    captures.push(captureMove);
                    
                    // Verificar se há mais capturas a partir desta posição
                    const virtualBoard = JSON.parse(JSON.stringify(gameState.board));
                    virtualBoard[checkRow][checkCol] = piece;
                    virtualBoard[fromRow][fromCol] = null;
                    virtualBoard[enemyPosition.row][enemyPosition.col] = null;
                    
                    const furtherCaptures = getKingCaptureMovesFromBoard(
                        checkRow, checkCol, piece, allCaptures, virtualBoard
                    );
                    
                    if (furtherCaptures.length > 0) {
                        captures.push(...furtherCaptures);
                    }
                } else {
                    // Casa ocupada - não pode capturar além
                    break;
                }
            }
        }
    }
    
    return captures;
}

// ===== FUNÇÃO GET KING CAPTURE MOVES FROM BOARD (NOVA) =====
function getKingCaptureMovesFromBoard(fromRow, fromCol, piece, currentCaptures, virtualBoard) {
    const captures = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    for (const [rowDir, colDir] of directions) {
        let foundEnemy = false;
        let enemyPosition = null;
        
        for (let distance = 1; distance <= 7; distance++) {
            const checkRow = fromRow + (rowDir * distance);
            const checkCol = fromCol + (colDir * distance);
            
            if (checkRow < 0 || checkRow > 7 || checkCol < 0 || checkCol > 7) break;
            
            const checkCell = virtualBoard[checkRow][checkCol];
            
            if (!foundEnemy) {
                if (checkCell) {
                    if (checkCell.color !== piece.color) {
                        foundEnemy = true;
                        enemyPosition = { row: checkRow, col: checkCol };
                        
                        const alreadyCaptured = currentCaptures.some(c => 
                            c.row === checkRow && c.col === checkCol
                        );
                        
                        if (alreadyCaptured) {
                            foundEnemy = false;
                            break;
                        }
                    } else {
                        break;
                    }
                }
            } else {
                if (checkCell === null) {
                    const newCapture = { 
                        row: enemyPosition.row, 
                        col: enemyPosition.col 
                    };
                    const allCaptures = [...currentCaptures, newCapture];
                    
                    const captureMove = {
                        fromRow,
                        fromCol,
                        toRow: checkRow,
                        toCol: checkCol,
                        captures: allCaptures
                    };
                    
                    captures.push(captureMove);
                    
                    // Continuar verificando recursivamente
                    const newVirtualBoard = JSON.parse(JSON.stringify(virtualBoard));
                    newVirtualBoard[checkRow][checkCol] = piece;
                    newVirtualBoard[fromRow][fromCol] = null;
                    newVirtualBoard[enemyPosition.row][enemyPosition.col] = null;
                    
                    const furtherCaptures = getKingCaptureMovesFromBoard(
                        checkRow, checkCol, piece, allCaptures, newVirtualBoard
                    );
                    
                    captures.push(...furtherCaptures);
                } else {
                    break;
                }
            }
        }
    }
    
    return captures;
}

// ===== ATUALIZAR RENDER BOARD PARA MOSTRAR TORCIDA =====
function renderBoard(boardState) {
    const board = document.getElementById('checkers-board');
    if (!board) return;
    
    board.innerHTML = '';
    
    if (!gameState || !gameState.players) return;
    
    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
    const isMyTurn = currentPlayer && currentPlayer.color === gameState.currentTurn;
    
    // Verificar capturas obrigatórias
    const hasMandatoryCaptures = checkGlobalMandatoryCaptures();
    
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
                
                // Adicionar indicador de torcida se houver muitos torcedores
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
                        pieceEl.style.cursor = 'not-allowed';
                    }
                }
                
                if (canSelect) {
                    pieceEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        handlePieceClick(row, col);
                    });
                    pieceEl.style.cursor = 'pointer';
                } else {
                    pieceEl.style.cursor = 'not-allowed';
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
// ===== FUNÇÃO CHECK GLOBAL MANDATORY CAPTURES (SIMPLIFICADA) =====
function checkGlobalMandatoryCaptures() {
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
                    capturingPieces.push({ row, col });
                    hasGlobalMandatoryCaptures = true;
                }
            }
        }
    }
    
    return hasGlobalMandatoryCaptures;
}

function getNormalMoves(fromRow, fromCol, piece) {
    const moves = [];
    const directions = [];
    
    if (piece.king) {
        directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    } else {
        const direction = piece.color === 'red' ? -1 : 1;
        directions.push([direction, -1], [direction, 1]);
    }
    
    for (const [rowDir, colDir] of directions) {
        const toRow = fromRow + rowDir;
        const toCol = fromCol + colDir;
        
        if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) continue;
        
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


// ===== DEBUG: VER TABULEIRO COMPLETO =====
function debugBoard() {
  console.log('=== TABULEIRO ATUAL ===');
  for (let row = 0; row < 8; row++) {
    let rowStr = '';
    for (let col = 0; col < 8; col++) {
      const piece = gameState.board[row][col];
      if (piece) {
        rowStr += piece.color === 'red' ? 'R' : 'B';
        rowStr += piece.king ? 'K' : ' ';
      } else {
        rowStr += (row + col) % 2 !== 0 ? '_ ' : 'X ';
      }
      rowStr += ' ';
    }
    console.log(row + ': ' + rowStr);
  }
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



// ===== VARIÁVEIS GLOBAIS =====
let spectatorsModal = null;

// ===== INICIALIZAÇÃO DO MODAL DE ESPECTADORES =====
function initializeSpectatorsModal() {
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
                                <i class="fas fa-heart red"></i>
                                <span>Vermelhas: <strong id="red-supporters-count">0</strong></span>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-heart black"></i>
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
    }
    
    spectatorsModal = document.getElementById('spectators-modal');
    
    // Event listeners
    document.getElementById('btn-spectators').addEventListener('click', openSpectatorsModal);
    document.getElementById('close-spectators').addEventListener('click', closeSpectatorsModal);
    
    // Fechar modal clicando fora
    spectatorsModal.addEventListener('click', (e) => {
        if (e.target === spectatorsModal) {
            closeSpectatorsModal();
        }
    });
    
    // Sistema de tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover classe active de todos
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            
            // Adicionar classe active ao selecionado
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });
}
// ===== INICIALIZAÇÃO DO MODAL DE ESPECTADORES (CORRIGIDA) =====
function initializeSpectatorsModal() {
    // Verificar se o botão existe antes de adicionar event listeners
    const spectatorsBtn = document.getElementById('btn-spectators');
    if (!spectatorsBtn) {
        console.log('Botão de espectadores não encontrado, tentando novamente...');
        setTimeout(initializeSpectatorsModal, 1000); // Tentar novamente após 1 segundo
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
                                <i class="fas fa-heart red"></i>
                                <span>Vermelhas: <strong id="red-supporters-count">0</strong></span>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-heart black"></i>
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
    }
    
    spectatorsModal = document.getElementById('spectators-modal');
    
    // Remover event listeners existentes para evitar duplicação
    spectatorsBtn.replaceWith(spectatorsBtn.cloneNode(true));
    const newSpectatorsBtn = document.getElementById('btn-spectators');
    
    // Adicionar event listeners
    newSpectatorsBtn.addEventListener('click', openSpectatorsModal);
    
    const closeBtn = document.getElementById('close-spectators');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSpectatorsModal);
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
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover classe active de todos
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            
            // Adicionar classe active ao selecionado
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });
    
    console.log('Modal de espectadores inicializado com sucesso!');
}

// ===== FUNÇÃO PARA ATUALIZAR TORCIDA (CORRIGIDA) =====
async function supportPlayer(playerColor) {
    if (!currentGameRef || !currentUser) {
        showNotification('Você precisa estar assistindo um jogo', 'error');
        return;
    }
    
    try {
        const spectatorRef = db.collection('tables')
            .doc(currentGameRef.id)
            .collection('spectators')
            .doc(currentUser.uid);
        
        // Verificar se já está torcendo para este time
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
                supporting: playerColor
            });
            userSupporting = playerColor;
            
            const playerName = gameState.players.find(p => p.color === playerColor)?.displayName || 
                              (playerColor === 'red' ? 'vermelhas' : 'pretas');
            showNotification(`Você está torcendo para ${playerName}!`, 'success');
        }
        
        // Atualizar modal se estiver aberto
        if (spectatorsModal && spectatorsModal.classList.contains('active')) {
            updateSpectatorsModal();
        }
        
    } catch (error) {
        console.error('Erro ao torcer:', error);
        showNotification('Erro ao torcer: ' + error.message, 'error');
    }
}

// ===== SETUP GAME LISTENER (ATUALIZADO) =====
function setupGameListener(tableId, isSpectator = false) {
    if (gameListener) gameListener();
    if (chatListener) cleanupChat();
    if (spectatorsListener) spectatorsListener();
    
    currentGameRef = db.collection('tables').doc(tableId);
    
    gameListener = currentGameRef.onSnapshot(async (doc) => {
        if (doc.exists) {
            gameState = doc.data();
            
            if (gameState.board && typeof gameState.board === 'object') {
                gameState.board = convertFirestoreFormatToBoard(gameState.board);
            }
            
            // Atualizar contador de espectadores (para todos)
            const spectatorsSnapshot = await currentGameRef.collection('spectators').get();
            await currentGameRef.update({
                spectatorsCount: spectatorsSnapshot.size
            });
            
            if (gameState.status === 'finished') {
                endGame(gameState.winner);
                return;
            }
            
            renderBoard(gameState.board);
            updatePlayerInfo();
            checkGlobalMandatoryCaptures();
            
            if (gameState.status === 'playing') {
                setupChatListener();
                setupSpectatorsListener(tableId);
                
                // Inicializar modal de espectadores apenas quando necessário
                if (isSpectator || gameState.players.some(p => p.uid === currentUser.uid)) {
                    setTimeout(initializeSpectatorsModal, 500); // Pequeno delay para garantir que o DOM esteja pronto
                }
            }
        }
    });
}

// ===== INITIALIZE UI (ATUALIZADO) =====
function initializeUI() {
    console.log('Inicializando interface do usuário...');
    
    // Navegação por abas
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems.length > 0) {
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const tabName = e.currentTarget.getAttribute('data-tab');
                switchTab(tabName);
            });
        });
    }
    
    // Modal de criação de mesa
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
    
    // Botões de fechar modal
    const modalCloseButtons = document.querySelectorAll('.modal-close, .modal-cancel');
    if (modalCloseButtons.length > 0) {
        modalCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                closeAllModals();
            });
        });
    }
    
    // Configurações
    const displayNameInput = document.getElementById('display-name');
    if (displayNameInput) {
        displayNameInput.addEventListener('change', updateUserProfile);
    }
    
    // Jogo
    const leaveGameBtn = document.getElementById('btn-leave-game');
    if (leaveGameBtn) {
        leaveGameBtn.addEventListener('click', leaveGame);
    }
    
    const surrenderBtn = document.getElementById('btn-surrender');
    if (surrenderBtn) {
        surrenderBtn.addEventListener('click', surrenderGame);
    }
    
    const offerDrawBtn = document.getElementById('btn-offer-draw');
    if (offerDrawBtn) {
        offerDrawBtn.addEventListener('click', offerDraw);
    }
    
    // Recuperação de senha
    const forgotPasswordLink = document.getElementById('forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showPasswordRecovery();
        });
    }
    
    // Conta de teste
    const testAccountBtn = document.getElementById('btn-test-account');
    if (testAccountBtn) {
        testAccountBtn.addEventListener('click', signInWithTestAccount);
    }
    
    // Chat
    initializeChat();
    
    // Modal de espectadores será inicializado quando necessário (no setupGameListener)
    console.log('UI inicializada - Modal de espectadores será carregado sob demanda');
}

// ===== LEAVE GAME (ATUALIZADO) =====
function leaveGame() {
    console.log('Saindo do jogo...');
    
    // Remover listeners
    if (gameListener) gameListener();
    if (chatListener) cleanupChat();
    if (spectatorsListener) spectatorsListener();
    
    // Fechar modal de espectadores se estiver aberto
    if (spectatorsModal) {
        closeSpectatorsModal();
    }
    
    // Se era espectador, remover da lista
    if (currentGameRef && currentUser) {
        const isPlayer = gameState && gameState.players && gameState.players.some(p => p.uid === currentUser.uid);
        if (!isPlayer) {
            db.collection('tables')
                .doc(currentGameRef.id)
                .collection('spectators')
                .doc(currentUser.uid)
                .delete()
                .catch(error => console.error('Erro ao sair como espectador:', error));
        }
    }
    
    // Limpar referências
    currentGameRef = null;
    gameState = null;
    selectedPiece = null;
    currentSpectators = [];
    userSupporting = null;
    spectatorsModal = null;
    
    // Voltar para a tela principal
    showScreen('main-screen');
    loadTables();
}

// ===== SHOW SCREEN (ATUALIZADO) =====
function showScreen(screenId) {
    console.log('Mostrando tela:', screenId);
    
    // Fechar modal de espectadores ao mudar de tela
    if (spectatorsModal) {
        closeSpectatorsModal();
    }
    
    // Primeiro, ocultar todas as telas
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    // Mostrar a tela solicitada
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
        screen.style.display = 'flex'; // Usar flex para melhor layout
        console.log('Tela', screenId, 'mostrada com sucesso');
        
        // Inicializar modal de espectadores apenas se for a tela de jogo
        if (screenId === 'game-screen') {
            setTimeout(() => {
                const spectatorsBtn = document.getElementById('btn-spectators');
                if (spectatorsBtn) {
                    initializeSpectatorsModal();
                }
            }, 1000);
        }
    }
}
// ===== FUNÇÃO PARA ABRIR MODAL =====
function openSpectatorsModal() {
    if (!spectatorsModal) {
        initializeSpectatorsModal();
    }
    
    // Atualizar dados antes de abrir
    updateSpectatorsModal();
    
    spectatorsModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Previne scroll do body
}

// ===== FUNÇÃO PARA FECHAR MODAL =====
function closeSpectatorsModal() {
    if (spectatorsModal) {
        spectatorsModal.classList.remove('active');
        document.body.style.overflow = ''; // Restaura scroll
    }
}

// ===== FUNÇÃO PARA ATUALIZAR MODAL =====
function updateSpectatorsModal() {
    if (!spectatorsModal || !spectatorsModal.classList.contains('active')) return;
    
    const totalSpectators = currentSpectators.length;
    const redSupporters = currentSpectators.filter(s => s.supporting === 'red');
    const blackSupporters = currentSpectators.filter(s => s.supporting === 'black');
    const neutralSpectators = currentSpectators.filter(s => !s.supporting);
    
    // Atualizar estatísticas
    document.getElementById('total-spectators').textContent = totalSpectators;
    document.getElementById('red-supporters-count').textContent = redSupporters.length;
    document.getElementById('black-supporters-count').textContent = blackSupporters.length;
    
    // Atualizar lista completa
    updateSpectatorsList('all', currentSpectators);
    
    // Atualizar listas por time
    updateSpectatorsList('red', redSupporters);
    updateSpectatorsList('black', blackSupporters);
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
                    <div class="support-badge ${spectator.supporting}">
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

// ===== FUNÇÃO FORMATAR TEMPO =====
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Agora';
    
    const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - time;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `Há ${minutes} min`;
    if (minutes < 1440) return `Há ${Math.floor(minutes / 60)} h`;
    return `Há ${Math.floor(minutes / 1440)} d`;
}
