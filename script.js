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
// ===== INTERFACE DO USUÁRIO =====
function initializeUI() {
  console.log('Inicializando interface do usuário...');
  
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
function showScreen(screenId) {
  console.log('Mostrando tela:', screenId);
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
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

// ===== MESAS DE JOGO =====
function loadTables() {
  // Remover listener anterior se existir
  if (tablesListener) tablesListener();
  
  tablesListener = db.collection('tables')
    .where('status', 'in', ['waiting', 'playing'])
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      const tablesContainer = document.getElementById('tables-container');
      if (tablesContainer) {
        tablesContainer.innerHTML = '';
        
        snapshot.forEach((doc) => {
          const table = { id: doc.id, ...doc.data() };
          renderTable(table, tablesContainer);
        });
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


// ===== FUNÇÃO PARA CRIAR MESA (VERSÃO MELHORADA) =====
async function createNewTable() {
  const tableName = document.getElementById('table-name').value || `Mesa de ${userData.displayName}`;
  const timeLimit = parseInt(document.getElementById('table-time').value);
  const bet = parseInt(document.getElementById('table-bet').value) || 0;
  
  // Verificar se tem moedas suficientes para a aposta
  if (bet > 0 && userData.coins < bet) {
    showNotification('Você não tem moedas suficientes para esta aposta', 'error');
    return;
  }
  
  try {
    // Converter o tabuleiro para formato Firestore-compatível
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
        color: 'red' // Primeiro jogador é sempre vermelho
      }],
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      currentTurn: 'red', // Vermelho começa
      board: boardData,
      waitingForOpponent: true // Nova flag para indicar que está aguardando adversário
    });
    
    // Se houver aposta, deduzir as moedas
    if (bet > 0) {
      await db.collection('users').doc(currentUser.uid).update({
        coins: firebase.firestore.FieldValue.increment(-bet)
      });
      
      userData.coins -= bet;
    }
    
    closeAllModals();
    showNotification('Mesa criada com sucesso! Aguardando adversário...', 'success');
    
    // Entrar na mesa que acabou de criar
    joinTable(tableRef.id);
    
  } catch (error) {
    console.error('Erro detalhado ao criar mesa:', error);
    showNotification('Erro ao criar mesa: ' + error.message, 'error');
  }
}

// ===== FUNÇÃO JOIN TABLE (ATUALIZADA) =====
async function joinTable(tableId) {
  try {
    const tableRef = db.collection('tables').doc(tableId);
    const tableDoc = await tableRef.get();
    
    if (!tableDoc.exists) {
      showNotification('Mesa não encontrada', 'error');
      return;
    }
    
    const table = tableDoc.data();
    
    // Verificar se a mesa está cheia
    if (table.players.length >= 2) {
      showNotification('Esta mesa já está cheia', 'error');
      return;
    }
    
    // Verificar se o usuário já está na mesa
    if (table.players.some(p => p.uid === currentUser.uid)) {
      showNotification('Você já está nesta mesa', 'error');
      return;
    }
    
    // Verificar se há aposta e se o usuário tem moedas suficientes
    if (table.bet > 0 && userData.coins < table.bet) {
      showNotification('Você não tem moedas suficientes para entrar nesta mesa', 'error');
      return;
    }
    
    // Adicionar jogador à mesa (segundo jogador sempre será preto)
    await tableRef.update({
      players: firebase.firestore.FieldValue.arrayUnion({
        uid: currentUser.uid,
        displayName: userData.displayName,
        rating: userData.rating,
        color: 'black'
      }),
      status: 'playing', // Mudar status para playing quando o segundo jogador entrar
      waitingForOpponent: false // Remover flag de espera
    });
    
    // Se houver aposta, deduzir as moedas
    if (table.bet > 0) {
      await db.collection('users').doc(currentUser.uid).update({
        coins: firebase.firestore.FieldValue.increment(-table.bet)
      });
      
      userData.coins -= table.bet;
    }
    
    // Entrar no jogo
    setupGameListener(tableId);
    showScreen('game-screen');
    showNotification('Jogo iniciado! As peças vermelhas começam.', 'success');
    
  } catch (error) {
    showNotification('Erro ao entrar na mesa: ' + error.message, 'error');
  }
}

// ===== FUNÇÃO RENDER TABLE (ATUALIZADA) =====
function renderTable(table, container) {
  const tableEl = document.createElement('div');
  tableEl.className = 'table-item';
  
  const playerCount = table.players ? table.players.length : 0;
  const isPlaying = table.status === 'playing';
  const isFull = playerCount >= 2;
  const isWaiting = table.waitingForOpponent;
  
  tableEl.innerHTML = `
    <div class="table-info">
      <div class="table-name">${table.name || `Mesa ${table.id}`}</div>
      <div class="table-details">
        <span><i class="fas fa-users"></i> ${playerCount}/2</span>
        <span><i class="fas fa-clock"></i> ${table.timeLimit || 0}s</span>
        ${table.bet > 0 ? `<span><i class="fas fa-coins"></i> ${table.bet}</span>` : ''}
        ${isWaiting ? `<span class="waiting-badge">Aguardando</span>` : ''}
      </div>
    </div>
    <div class="table-actions">
      ${isPlaying || isFull ? 
        `<button class="btn btn-secondary btn-small" disabled>${isPlaying ? 'Jogando' : 'Cheia'}</button>` : 
        `<button class="btn btn-primary btn-small join-btn">Entrar</button>`
      }
    </div>
  `;
  
  if (!isPlaying && !isFull) {
    const joinBtn = tableEl.querySelector('.join-btn');
    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        joinTable(table.id);
      });
    }
  }
  
  container.appendChild(tableEl);
}

// ===== FUNÇÃO SETUP GAME LISTENER (ATUALIZADA) =====
function setupGameListener(tableId) {
  // Remover listener anterior se existir
  if (gameListener) gameListener();
  
  currentGameRef = db.collection('tables').doc(tableId);
  
  gameListener = currentGameRef.onSnapshot((doc) => {
    if (doc.exists) {
      gameState = doc.data();
      
      // Converter o tabuleiro do formato Firestore para array bidimensional
      if (gameState.board && typeof gameState.board === 'object') {
        gameState.board = convertFirestoreFormatToBoard(gameState.board);
      }
      
      // Verificar se o jogo terminou
      if (gameState.status === 'finished') {
        endGame(gameState.winner);
        return;
      }
      
      // Verificar se é a vez do jogador atual
      const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
      const isMyTurn = currentPlayer && currentPlayer.color === gameState.currentTurn;
      
      // Renderizar o tabuleiro
      renderBoard(gameState.board);
      
      // Atualizar informações dos jogadores
      updatePlayerInfo();
      
      // Mostrar mensagem de quem começa
      if (gameState.players.length === 2 && gameState.currentTurn === 'red') {
        showNotification('Jogo iniciado! As peças vermelhas começam.', 'info');
      }
      
      // Se for a vez do jogador, verificar capturas obrigatórias
      if (isMyTurn) {
        checkForMandatoryCaptures(currentPlayer.color);
      }
    }
  }, (error) => {
    console.error('Erro ao escutar atualizações do jogo:', error);
  });
}


// ===== FUNÇÃO RENDERBOARD =====
function renderBoard(boardState) {
  const board = document.getElementById('checkers-board');
  if (!board) {
    console.error('Elemento do tabuleiro não encontrado');
    return;
  }
  
  // Limpar o tabuleiro
  board.innerHTML = '';
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = document.createElement('div');
      cell.className = `board-cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
      cell.dataset.row = row;
      cell.dataset.col = col;
      
      // Adicionar evento de clique apenas para casas escuras
      if ((row + col) % 2 !== 0) {
        cell.addEventListener('click', () => handleCellClick(row, col));
      }
      
      // Adicionar peça se existir
      const piece = boardState[row][col];
      if (piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className = `checker-piece ${piece.color} ${piece.king ? 'king' : ''}`;
        pieceEl.dataset.row = row;
        pieceEl.dataset.col = col;
        
        // Adicionar evento de clique apenas para peças do jogador atual
        if (gameState && piece.color === (gameState.currentTurn === 'red' ? 'red' : 'black')) {
          pieceEl.addEventListener('click', (e) => {
            e.stopPropagation();
            handlePieceClick(row, col);
          });
        }
        
        cell.appendChild(pieceEl);
      }
      
      board.appendChild(cell);
    }
  }
  
  // Atualizar informação de turno se disponível
  if (gameState) {
    const turnEl = document.getElementById('game-turn');
    if (turnEl) {
      turnEl.innerHTML = `<span>Vez das ${gameState.currentTurn === 'red' ? 'vermelhas' : 'pretas'}</span>`;
      turnEl.style.backgroundColor = gameState.currentTurn === 'red' ? '#e74c3c' : '#2c3e50';
    }
  }
}

// ===== FUNÇÃO LEAVE GAME =====
function leaveGame() {
  console.log('Saindo do jogo...');
  
  // Remover listener do jogo
  if (gameListener) {
    gameListener();
    gameListener = null;
  }
  
  // Limpar referências do jogo
  currentGameRef = null;
  gameState = null;
  selectedPiece = null;
  
  // Voltar para a tela principal
  showScreen('main-screen');
  
  // Recarregar mesas disponíveis
  loadTables();
}

// ===== FUNÇÃO HANDLE CELL CLICK =====
function handleCellClick(row, col) {
  console.log('Célula clicada:', row, col);
  
  if (!selectedPiece) {
    console.log('Nenhuma peça selecionada');
    return;
  }
  
  const moves = getPossibleMoves(selectedPiece.row, selectedPiece.col);
  const validMove = moves.find(m => m.toRow === row && m.toCol === col);
  
  if (validMove) {
    console.log('Movimento válido encontrado:', validMove);
    makeMove(selectedPiece.row, selectedPiece.col, row, col, validMove.captures);
  } else {
    console.log('Movimento inválido');
    showNotification('Movimento inválido!', 'error');
  }
  
  // Limpar seleção
  clearSelection();
}

// ===== FUNÇÃO HANDLE PIECE CLICK =====
function handlePieceClick(row, col) {
  console.log('Peça clicada:', row, col);
  
  // Desselecionar peça anterior se houver
  if (selectedPiece) {
    const previousSelected = document.querySelector('.checker-piece.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }
  }
  
  // Selecionar nova peça
  selectedPiece = { row, col };
  const pieceEl = document.querySelector(`.checker-piece[data-row="${row}"][data-col="${col}"]`);
  
  if (pieceEl) {
    pieceEl.classList.add('selected');
    
    // Mostrar movimentos possíveis
    showPossibleMoves(row, col);
  }
}
// ===== FUNÇÃO SHOW POSSIBLE MOVES =====
function showPossibleMoves(row, col) {
  console.log('Mostrando movimentos possíveis para:', row, col);
  
  // Limpar indicações anteriores
  clearHighlights();
  
  const moves = getPossibleMoves(row, col);
  console.log('Movimentos possíveis:', moves);
  
  moves.forEach(move => {
    const cell = document.querySelector(`.board-cell[data-row="${move.toRow}"][data-col="${move.toCol}"]`);
    if (cell) {
      cell.classList.add('highlighted');
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

// ===== FUNÇÃO OFFER DRAW =====
async function offerDraw() {
  console.log('Ofertando empate...');
  
  if (!currentGameRef || !gameState) {
    showNotification('Nenhum jogo ativo para oferecer empate', 'error');
    return;
  }
  
  try {
    // Verificar se já existe uma oferta de empate pendente
    if (gameState.drawOffer && gameState.drawOffer.from !== currentUser.uid) {
      // Aceitar empate
      const confirm = await showConfirmModal('Empate', 'Aceitar proposta de empate?');
      if (confirm) {
        await endGame('draw');
      }
      return;
    }
    
    // Oferecer empate
    await currentGameRef.update({
      drawOffer: {
        from: currentUser.uid,
        at: firebase.firestore.FieldValue.serverTimestamp()
      }
    });
    
    showNotification('Proposta de empate enviada', 'info');
    
  } catch (error) {
    console.error('Erro ao oferecer empate:', error);
    showNotification('Erro ao oferecer empate: ' + error.message, 'error');
  }
}

// ===== FUNÇÃO END GAME =====
async function endGame(result) {
  try {
    let winner = null;
    let status = 'finished';
    
    if (result === 'draw') {
      status = 'draw';
      // Atualizar estatísticas para empate
      for (const player of gameState.players) {
        await db.collection('users').doc(player.uid).update({
          draws: firebase.firestore.FieldValue.increment(1),
          rating: firebase.firestore.FieldValue.increment(5) // Pequeno aumento para ambos
        });
      }
    } else {
      winner = result;
      const winningPlayer = gameState.players.find(p => p.color === winner);
      const losingPlayer = gameState.players.find(p => p.color !== winner);
      
      // Calcular recompensas
      const betAmount = gameState.bet || 0;
      const reward = betAmount * 2;
      
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
    }
    
    // Atualizar estado do jogo
    await currentGameRef.update({
      status: status,
      winner: winner,
      finishedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    if (result === 'draw') {
      showNotification('Jogo terminou em empate!', 'info');
    } else {
      const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
      if (currentPlayer.color === winner) {
        showNotification('Você venceu!', 'success');
      } else {
        showNotification('Você perdeu!', 'error');
      }
    }
    
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

// ===== FUNÇÃO MAKE MOVE (ATUALIZADA) =====
async function makeMove(fromRow, fromCol, toRow, toCol, captures) {
  try {
    // Criar uma cópia do tabuleiro
    const newBoard = JSON.parse(JSON.stringify(gameState.board));
    const movingPiece = newBoard[fromRow][fromCol];
    
    // Mover a peça
    newBoard[toRow][toCol] = movingPiece;
    newBoard[fromRow][fromCol] = null;
    
    // Realizar capturas
    if (captures && captures.length > 0) {
      captures.forEach(capture => {
        newBoard[capture.row][capture.col] = null;
      });
    }
    
    // Verificar se a peça se tornou uma dama
    if ((movingPiece.color === 'red' && toRow === 0) || 
        (movingPiece.color === 'black' && toRow === 7)) {
      newBoard[toRow][toCol].king = true;
    }
    
    // Determinar próximo turno
    let nextTurn = gameState.currentTurn === 'red' ? 'black' : 'red';
    
    // Se houve captura, verificar se há mais capturas possíveis
    if (captures && captures.length > 0) {
      const moreCaptures = getCaptureMoves(toRow, toCol, movingPiece);
      if (moreCaptures.length > 0) {
        // O mesmo jogador joga novamente
        nextTurn = gameState.currentTurn;
        showNotification('Captura múltipla disponível!', 'info');
      }
    }
    
    // Converter o tabuleiro para formato Firestore antes de salvar
    const firestoreBoard = convertBoardToFirestoreFormat(newBoard);
    
    // Atualizar o estado do jogo
    await currentGameRef.update({
      board: firestoreBoard,
      currentTurn: nextTurn,
      lastMove: {
        fromRow, fromCol, toRow, toCol, captures
      }
    });
    
    // Verificar se o jogo terminou
    checkGameEnd(newBoard, nextTurn);
    
  } catch (error) {
    console.error('Erro detalhado ao realizar movimento:', error);
    showNotification('Erro ao realizar movimento: ' + error.message, 'error');
  }
}

// ===== FUNÇÃO CHECK FOR MANDATORY CAPTURES =====
function checkForMandatoryCaptures(color) {
  console.log('Verificando capturas obrigatórias para:', color);
  
  if (!gameState || !gameState.board) {
    console.error('Estado do jogo ou tabuleiro não disponível');
    return false;
  }
  
  // Verificar se há capturas obrigatórias para o jogador atual
  let hasCaptures = false;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = gameState.board[row][col];
      if (piece && piece.color === color) {
        const captures = getCaptureMoves(row, col, piece);
        if (captures.length > 0) {
          hasCaptures = true;
          console.log('Capturas obrigatórias encontradas para peça em:', row, col);
          break;
        }
      }
    }
    if (hasCaptures) break;
  }
  
  if (hasCaptures) {
    showNotification('Você tem capturas obrigatórias!', 'warning');
  }
  
  return hasCaptures;
}

// ===== FUNÇÃO GET CAPTURE MOVES =====
function getCaptureMoves(fromRow, fromCol, piece) {
  const captures = [];
  const direction = piece.color === 'red' ? -1 : 1;
  
  // Verificar capturas em todas as direções (para damas)
  checkCaptureInDirection(captures, fromRow, fromCol, -1, -1, piece); // Diagonal superior esquerda
  checkCaptureInDirection(captures, fromRow, fromCol, -1, 1, piece);  // Diagonal superior direita
  checkCaptureInDirection(captures, fromRow, fromCol, 1, -1, piece);  // Diagonal inferior esquerda
  checkCaptureInDirection(captures, fromRow, fromCol, 1, 1, piece);   // Diagonal inferior direita
  
  return captures;
}

// ===== FUNÇÃO CHECK CAPTURE IN DIRECTION =====
function checkCaptureInDirection(captures, fromRow, fromCol, rowDir, colDir, piece) {
  // Para peças normais, só podem capturar para frente
  if (!piece.king) {
    const direction = piece.color === 'red' ? -1 : 1;
    if (rowDir !== direction) return;
  }
  
  const jumpRow = fromRow + rowDir;
  const jumpCol = fromCol + colDir;
  const landRow = fromRow + 2 * rowDir;
  const landCol = fromCol + 2 * colDir;
  
  // Verificar se está dentro do tabuleiro
  if (landRow < 0 || landRow > 7 || landCol < 0 || landCol > 7) return;
  
  const jumpedPiece = gameState.board[jumpRow][jumpCol];
  const landingCell = gameState.board[landRow][landCol];
  
  // Verificar se há uma peça para capturar e se a célula de destino está vazia
  if (jumpedPiece && jumpedPiece.color !== piece.color && !landingCell) {
    captures.push({
      fromRow,
      fromCol,
      toRow: landRow,
      toCol: landCol,
      captures: [{ row: jumpRow, col: jumpCol }]
    });
    
    // Verificar capturas múltiplas
    checkMultipleCaptures(captures, landRow, landCol, rowDir, colDir, piece, [{ row: jumpRow, col: jumpCol }]);
  }
}

// ===== FUNÇÃO CHECK MULTIPLE CAPTURES =====
function checkMultipleCaptures(captures, fromRow, fromCol, rowDir, colDir, piece, capturedSoFar) {
  // Verificar todas as direções para capturas adicionais
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  
  for (const [dirRow, dirCol] of directions) {
    // Para peças normais, só podem capturar para frente
    if (!piece.king) {
      const direction = piece.color === 'red' ? -1 : 1;
      if (dirRow !== direction) continue;
    }
    
    const jumpRow = fromRow + dirRow;
    const jumpCol = fromCol + dirCol;
    const landRow = fromRow + 2 * dirRow;
    const landCol = fromCol + 2 * dirCol;
    
    // Verificar se está dentro do tabuleiro
    if (landRow < 0 || landRow > 7 || landCol < 0 || landCol > 7) continue;
    
    const jumpedPiece = gameState.board[jumpRow][jumpCol];
    const landingCell = gameState.board[landRow][landCol];
    
    // Verificar se a peça já foi capturada
    const alreadyCaptured = capturedSoFar.some(c => c.row === jumpRow && c.col === jumpCol);
    
    // Verificar se há uma peça para capturar e se a célula de destino está vazia
    if (!alreadyCaptured && jumpedPiece && jumpedPiece.color !== piece.color && !landingCell) {
      const newCapture = { row: jumpRow, col: jumpCol };
      const allCaptures = [...capturedSoFar, newCapture];
      
      captures.push({
        fromRow: fromRow,
        fromCol: fromCol,
        toRow: landRow,
        toCol: landCol,
        captures: allCaptures
      });
      
      // Verificar mais capturas a partir desta posição
      checkMultipleCaptures(captures, landRow, landCol, dirRow, dirCol, piece, allCaptures);
    }
  }
}

// ===== FUNÇÃO GET POSSIBLE MOVES (ATUALIZADA) =====
function getPossibleMoves(fromRow, fromCol) {
  console.log('Obtendo movimentos para:', fromRow, fromCol);
  
  if (!gameState || !gameState.board) {
    console.error('Estado do jogo ou tabuleiro não disponível');
    return [];
  }
  
  const piece = gameState.board[fromRow][fromCol];
  if (!piece) {
    console.error('Nenhuma peça na posição:', fromRow, fromCol);
    return [];
  }
  
  const moves = [];
  const direction = piece.color === 'red' ? -1 : 1;
  
  // Verificar capturas obrigatórias primeiro
  const captures = getCaptureMoves(fromRow, fromCol, piece);
  if (captures.length > 0) {
    console.log('Capturas obrigatórias encontradas:', captures);
    return captures;
  }
  
  // Movimentos normais (apenas se não houver capturas)
  if (piece.king) {
    // Damas podem mover-se para trás também
    addMoveIfValid(moves, fromRow, fromCol, fromRow + direction, fromCol - 1, false, piece);
    addMoveIfValid(moves, fromRow, fromCol, fromRow + direction, fromCol + 1, false, piece);
    addMoveIfValid(moves, fromRow, fromCol, fromRow - direction, fromCol - 1, false, piece);
    addMoveIfValid(moves, fromRow, fromCol, fromRow - direction, fromCol + 1, false, piece);
  } else {
    // Peças normais só se movem para frente
    addMoveIfValid(moves, fromRow, fromCol, fromRow + direction, fromCol - 1, false, piece);
    addMoveIfValid(moves, fromRow, fromCol, fromRow + direction, fromCol + 1, false, piece);
  }
  
  console.log('Movimentos válidos encontrados:', moves);
  return moves;
}

// ===== FUNÇÃO ADD MOVE IF VALID =====
function addMoveIfValid(moves, fromRow, fromCol, toRow, toCol, isCapture, piece) {
  // Verificar se está dentro do tabuleiro
  if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
  
  // Verificar se a célula de destino está vazia
  if (gameState.board[toRow][toCol]) return false;
  
  // Para peças normais, só podem mover para frente (a menos que seja uma captura)
  if (!piece.king && !isCapture) {
    const direction = piece.color === 'red' ? -1 : 1;
    if ((toRow - fromRow) * direction <= 0) return false;
  }
  
  // Verificar se é uma casa escura (onde as peças podem se mover)
  if ((toRow + toCol) % 2 === 0) return false;
  
  moves.push({
    fromRow,
    fromCol,
    toRow,
    toCol,
    captures: isCapture ? [] : null
  });
  
  return true;
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

// ===== INICIALIZAÇÃO DO TABULEIRO =====
function initializeBrazilianCheckersBoard() {
  const board = Array(8).fill().map(() => Array(8).fill(null));
  
  // Posicionar peças vermelhas (topo)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 !== 0) {
        board[row][col] = { color: 'red', king: false };
      }
    }
  }
  
  // Posicionar peças pretas (base)
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 !== 0) {
        board[row][col] = { color: 'black', king: false };
      }
    }
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