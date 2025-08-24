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


// ===== FUNÇÃO SETUP GAME LISTENER (COMPLETA) =====
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
            
            // Renderizar o tabuleiro e atualizar UI
            renderBoard(gameState.board);
            updatePlayerInfo();
            updateTurnInfo();
            
            // Verificar capturas obrigatórias
            checkGlobalMandatoryCaptures();
            
        }
    }, (error) => {
        console.error('Erro ao escutar atualizações do jogo:', error);
    });
}
// ===== SISTEMA DE BLOQUEIO TOTAL =====
let mandatoryCaptures = [];

// ===== FUNÇÃO PRINCIPAL DE VERIFICAÇÃO =====
function checkGlobalMandatoryCaptures() {
    const currentColor = gameState.currentTurn;
    mandatoryCaptures = [];
    
    // Encontrar TODAS as capturas possíveis para a cor atual
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameState.board[row][col];
            if (piece && piece.color === currentColor) {
                const captures = getCaptureMoves(row, col, piece, []);
                if (captures.length > 0) {
                    mandatoryCaptures.push({
                        piece: { row, col },
                        captures: captures
                    });
                }
            }
        }
    }
    
    const hasMandatoryCaptures = mandatoryCaptures.length > 0;
    
    if (hasMandatoryCaptures) {
        console.log('CAPTURAS OBRIGATÓRIAS:', mandatoryCaptures);
        showNotification('Captura obrigatória! Você deve capturar.', 'warning');
        
        // Bloquear imediatamente todas as outras peças
        blockNonCapturingPieces();
    }
    
    return hasMandatoryCaptures;
}

// ===== BLOQUEIO DE PEÇAS QUE NÃO PODEM CAPTURAR =====
function blockNonCapturingPieces() {
    const pieces = document.querySelectorAll('.checker-piece');
    
    pieces.forEach(piece => {
        const row = parseInt(piece.dataset.row);
        const col = parseInt(piece.dataset.col);
        const pieceObj = gameState.board[row][col];
        
        if (pieceObj && pieceObj.color === gameState.currentTurn) {
            // Verificar se esta peça está na lista de peças que podem capturar
            const canCapture = mandatoryCaptures.some(capture => 
                capture.piece.row === row && capture.piece.col === col
            );
            
            if (!canCapture) {
                // BLOQUEAR COMPLETAMENTE esta peça
                piece.classList.add('disabled-piece');
                piece.style.opacity = '0.3';
                piece.style.cursor = 'not-allowed';
                piece.style.pointerEvents = 'none'; // Impede completamente interação
                
                // Remover event listeners existentes
                const newPiece = piece.cloneNode(true);
                piece.parentNode.replaceChild(newPiece, piece);
            } else {
                // Permitir esta peça (pode capturar)
                piece.classList.remove('disabled-piece');
                piece.style.opacity = '1';
                piece.style.cursor = 'pointer';
                piece.style.pointerEvents = 'auto';
                
                // Adicionar event listener
                piece.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handlePieceClick(row, col);
                });
            }
        }
    });
}
// ===== FUNÇÃO UPDATE TURN INFO =====
function updateTurnInfo() {
    if (!gameState) return;
    
    const turnEl = document.getElementById('game-turn');
    if (turnEl) {
        const currentPlayer = gameState.players.find(p => p.color === gameState.currentTurn);
        const playerName = currentPlayer ? currentPlayer.displayName : 'Jogador';
        
        turnEl.innerHTML = `
            <span>Vez de: ${playerName}</span>
            <span>(${gameState.currentTurn === 'red' ? 'Vermelhas' : 'Pretas'})</span>
        `;
        turnEl.style.backgroundColor = gameState.currentTurn === 'red' ? '#e74c3c' : '#2c3e50';
    }
    
    // Atualizar informações dos jogadores
    updatePlayerInfo();
}

// ===== FUNÇÃO RENDER BOARD (CORRIGIDA) =====
function renderBoard(boardState) {
    const board = document.getElementById('checkers-board');
    if (!board) return;
    
    board.innerHTML = '';
    
    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
    const isMyTurn = currentPlayer && currentPlayer.color === gameState.currentTurn;
    
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
                
                let canSelect = isMyTurn && piece.color === currentPlayer.color;
                
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
    
    // APÓS renderizar, verificar e bloquear se necessário
    setTimeout(() => {
        checkGlobalMandatoryCaptures();
    }, 100);
    
    updateTurnInfo(); // Atualizar informações do turno
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
    
    // Verificação final de capturas obrigatórias
    const hasMandatoryCaptures = checkGlobalMandatoryCaptures();
    
    if (hasMandatoryCaptures) {
        const moves = getPossibleMoves(selectedPiece.row, selectedPiece.col);
        const validMove = moves.find(m => m.toRow === row && m.toCol === col);
        
        if (validMove) {
            makeMove(selectedPiece.row, selectedPiece.col, row, col, validMove.captures);
        } else {
            showNotification('Movimento inválido! Você deve capturar.', 'error');
        }
    } else {
        const moves = getPossibleMoves(selectedPiece.row, selectedPiece.col);
        const validMove = moves.find(m => m.toRow === row && m.toCol === col);
        
        if (validMove) {
            makeMove(selectedPiece.row, selectedPiece.col, row, col, validMove.captures);
        } else {
            showNotification('Movimento inválido!', 'error');
        }
    }
    
    clearSelection();
}
// ===== FUNÇÃO HIGHLIGHT CAPTURING PIECES (MELHORADA) =====
function highlightCapturingPieces() {
    // Limpar destaques anteriores
    document.querySelectorAll('.checker-piece').forEach(piece => {
        piece.classList.remove('capture-possible', 'capture-mandatory');
    });
    
    // Destacar peças que podem capturar
    mandatoryCaptures.forEach(captureInfo => {
        const { row, col } = captureInfo.piece;
        const pieceEl = document.querySelector(`.checker-piece[data-row="${row}"][data-col="${col}"]`);
        
        if (pieceEl) {
            pieceEl.classList.add('capture-mandatory');
            pieceEl.style.animation = 'pulse-red 1s infinite';
        }
    });
}

// ===== FUNÇÃO END GAME (COMPLETA) =====
async function endGame(winner) {
    try {
        let status = 'finished';
        
        if (winner === 'draw') {
            status = 'draw';
            // Atualizar estatísticas para empate
            for (const player of gameState.players) {
                await db.collection('users').doc(player.uid).update({
                    draws: firebase.firestore.FieldValue.increment(1),
                    rating: firebase.firestore.FieldValue.increment(5)
                });
            }
        } else {
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
        
        // Mostrar mensagem final
        const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
        if (winner === 'draw') {
            showNotification('Jogo terminou em empate!', 'info');
        } else if (currentPlayer.color === winner) {
            showNotification('Você venceu! Parabéns!', 'success');
        } else {
            showNotification('Você perdeu! Melhor sorte na próxima.', 'error');
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

// ===== FUNÇÃO LEAVE GAME (COMPLETA) =====
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
    mandatoryCaptureState = {
        hasMandatoryCaptures: false,
        capturingPiece: null,
        availableCaptures: []
    };
    
    // Voltar para a tela principal
    showScreen('main-screen');
    
    // Recarregar mesas disponíveis
    loadTables();
    
    // Recarregar ranking
    loadRanking();
}

// ===== FUNÇÃO HANDLE PIECE CLICK (BLOQUEIO DE SELEÇÃO) =====
function handlePieceClick(row, col) {
   const piece = gameState.board[row][col];
    if (!piece || piece.color !== gameState.currentTurn) return;
    
    // Verificação FINAL - impossibilitar qualquer bypass
    const hasMandatoryCaptures = mandatoryCaptures.length > 0;
    
    if (hasMandatoryCaptures) {
        // Verificar se esta peça específica está autorizada a capturar
        const canThisPieceCapture = mandatoryCaptures.some(capture => 
            capture.piece.row === row && capture.piece.col === col
        );
        
        if (!canThisPieceCapture) {
            showNotification('Captura obrigatória! Use outra peça.', 'error');
            highlightCapturingPieces();
            return;
        }
    }
  
  // Verificar captura múltipla em andamento
  if (mandatoryCaptureState.hasMandatoryCaptures) {
    if (row !== mandatoryCaptureState.capturingPiece.row || 
        col !== mandatoryCaptureState.capturingPiece.col) {
      showNotification('Continue capturando com a mesma peça!', 'error');
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
        cell.title = 'Captura disponível';
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
// ===== FUNÇÃO UPDATE PLAYER INFO (COMPLETA) =====
function updatePlayerInfo() {
    if (!gameState || !gameState.players) return;
    
    const opponent = gameState.players.find(p => p.uid !== currentUser.uid);
    const currentPlayer = gameState.players.find(p => p.uid === currentUser.uid);
    
    // Atualizar informações do oponente
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
    
    // Atualizar informações do jogador atual
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


// ===== SISTEMA DE CAPTURA OBRIGATÓRIA E MÚLTIPLA =====
let mandatoryCaptureState = {
    hasMandatoryCaptures: false,
    capturingPiece: null,
    availableCaptures: []
};

// ===== FUNÇÃO PRINCIPAL DE VERIFICAÇÃO DE CAPTURAS =====
function checkGlobalMandatoryCaptures() {
    if (!gameState || !gameState.board) return false;
    
    const currentColor = gameState.currentTurn;
    const allCaptures = [];
    
    // Encontrar TODAS as capturas possíveis para a cor atual
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameState.board[row][col];
            if (piece && piece.color === currentColor) {
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
    
    const hasMandatoryCaptures = allCaptures.length > 0;
    
    if (hasMandatoryCaptures) {
        console.log('CAPTURAS OBRIGATÓRIAS DETECTADAS:', allCaptures.length);
        showNotification('Captura obrigatória! Você deve capturar.', 'warning');
        
        // Atualizar estado global
        mandatoryCaptureState.hasMandatoryCaptures = true;
        
        // Bloquear peças que não podem capturar
        blockNonCapturingPieces(allCaptures);
    } else {
        mandatoryCaptureState.hasMandatoryCaptures = false;
        mandatoryCaptureState.capturingPiece = null;
        mandatoryCaptureState.availableCaptures = [];
        
        // Liberar todas as peças
        unblockAllPieces();
    }
    
    return hasMandatoryCaptures;
}

// ===== BLOQUEIO DE PEÇAS QUE NÃO PODEM CAPTURAR =====
function blockNonCapturingPieces(allowedCaptures) {
    const pieces = document.querySelectorAll('.checker-piece');
    const allowedPositions = allowedCaptures.map(c => `${c.piece.row},${c.piece.col}`);
    
    pieces.forEach(piece => {
        const row = parseInt(piece.dataset.row);
        const col = parseInt(piece.dataset.col);
        const pieceObj = gameState.board[row][col];
        
        if (pieceObj && pieceObj.color === gameState.currentTurn) {
            const positionKey = `${row},${col}`;
            const canCapture = allowedPositions.includes(positionKey);
            
            if (!canCapture) {
                // BLOQUEAR COMPLETAMENTE esta peça
                piece.classList.add('disabled-piece');
                piece.style.opacity = '0.3';
                piece.style.cursor = 'not-allowed';
                piece.style.pointerEvents = 'none';
            } else {
                // Liberar peça que pode capturar
                piece.classList.remove('disabled-piece');
                piece.style.opacity = '1';
                piece.style.cursor = 'pointer';
                piece.style.pointerEvents = 'auto';
            }
        }
    });
}

// ===== LIBERAR TODAS AS PEÇAS =====
function unblockAllPieces() {
    const pieces = document.querySelectorAll('.checker-piece');
    
    pieces.forEach(piece => {
        piece.classList.remove('disabled-piece');
        piece.style.opacity = '1';
        piece.style.cursor = 'pointer';
        piece.style.pointerEvents = 'auto';
    });
}

// ===== FUNÇÃO GET CAPTURE MOVES (OTIMIZADA) =====
function getCaptureMoves(fromRow, fromCol, piece, currentCaptures = []) {
    const captures = [];
    const directions = [];
    
    if (piece.king) {
        directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    } else {
        const direction = piece.color === 'red' ? -1 : 1;
        directions.push([direction, -1], [direction, 1]);
    }
    
    for (const [rowDir, colDir] of directions) {
        const jumpRow = fromRow + rowDir;
        const jumpCol = fromCol + colDir;
        const landRow = fromRow + 2 * rowDir;
        const landCol = fromCol + 2 * colDir;
        
        // Verificar limites do tabuleiro
        if (landRow < 0 || landRow > 7 || landCol < 0 || landCol > 7) continue;
        
        const jumpedPiece = gameState.board[jumpRow][jumpCol];
        const landingCell = gameState.board[landRow][landCol];
        
        // Verificar se a peça já foi capturada nesta sequência
        const alreadyCaptured = currentCaptures.some(c => 
            c.row === jumpRow && c.col === jumpCol
        );
        
        // Verificar condições de captura
        if (!alreadyCaptured && 
            jumpedPiece && 
            jumpedPiece.color !== piece.color && 
            landingCell === null &&
            (landRow + landCol) % 2 !== 0) {
            
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
            
            // Verificar capturas múltiplas recursivamente
            const furtherCaptures = getCaptureMoves(landRow, landCol, piece, allCaptures);
            if (furtherCaptures.length > 0) {
                captures.push(...furtherCaptures);
            }
        }
    }
    
    return captures;
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

// ===== FUNÇÃO MAKE MOVE (CAPTURAS MÚLTIPLAS CORRETAS) =====
async function makeMove(fromRow, fromCol, toRow, toCol, captures) {
    try {
        const newBoard = JSON.parse(JSON.stringify(gameState.board));
        const movingPiece = newBoard[fromRow][fromCol];
        
        // Executar movimento
        newBoard[toRow][toCol] = movingPiece;
        newBoard[fromRow][fromCol] = null;
        
        // Executar capturas
        if (captures && captures.length > 0) {
            captures.forEach(capture => {
                newBoard[capture.row][capture.col] = null;
            });
        }
        
        // Verificar promoção a dama
        if ((movingPiece.color === 'red' && toRow === 0) || 
            (movingPiece.color === 'black' && toRow === 7)) {
            newBoard[toRow][toCol].king = true;
        }
        
        // Verificar se há mais capturas possíveis a partir da nova posição
        const moreCaptures = getCaptureMoves(toRow, toCol, newBoard[toRow][toCol], captures || []);
        
        let nextTurn = gameState.currentTurn;
        
        if (moreCaptures.length > 0) {
            // CAPTURA MÚLTIPLA: mesmo jogador continua
            mandatoryCaptureState = {
                hasMandatoryCaptures: true,
                capturingPiece: { row: toRow, col: toCol },
                availableCaptures: moreCaptures
            };
            
            showNotification('Continue capturando!', 'info');
        } else {
            // Finalizar jogada - passar vez
            nextTurn = gameState.currentTurn === 'red' ? 'black' : 'red';
            mandatoryCaptureState = {
                hasMandatoryCaptures: false,
                capturingPiece: null,
                availableCaptures: []
            };
        }
        
        // Atualizar Firestore
        const firestoreBoard = convertBoardToFirestoreFormat(newBoard);
        await currentGameRef.update({
            board: firestoreBoard,
            currentTurn: nextTurn,
            lastMove: {
                fromRow, fromCol, toRow, toCol, captures
            }
        });
        
        // Atualizar estado local
        gameState.board = newBoard;
        gameState.currentTurn = nextTurn;
        
        // Verificar capturas obrigatórias para o próximo estado
        setTimeout(() => {
            checkGlobalMandatoryCaptures();
            
            if (moreCaptures.length > 0) {
                // Selecionar automaticamente a peça para continuar capturando
                selectedPiece = { row: toRow, col: toCol };
                const pieceEl = document.querySelector(`.checker-piece[data-row="${toRow}"][data-col="${toCol}"]`);
                if (pieceEl) {
                    pieceEl.classList.add('selected');
                    showPossibleMoves(toRow, toCol);
                }
            } else {
                checkGameEnd(newBoard, nextTurn);
            }
        }, 100);
        
    } catch (error) {
        console.error('Erro ao realizar movimento:', error);
        showNotification('Erro ao realizar movimento: ' + error.message, 'error');
    }
}

// ===== FUNÇÃO CHECK GAME END (COMPLETA E ROBUSTA) =====
function checkGameEnd(board, currentTurn) {
    let redPieces = 0;
    let blackPieces = 0;
    let redCanMove = false;
    let blackCanMove = false;
    
    // Contar peças e verificar movimentos possíveis
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece) {
                if (piece.color === 'red') {
                    redPieces++;
                    if (!redCanMove) {
                        const moves = getPossibleMoves(row, col);
                        redCanMove = moves.length > 0;
                    }
                } else {
                    blackPieces++;
                    if (!blackCanMove) {
                        const moves = getPossibleMoves(row, col);
                        blackCanMove = moves.length > 0;
                    }
                }
            }
        }
    }
    
    // Verificar condições de vitória
    if (redPieces === 0 || !redCanMove) {
        endGame('black');
    } else if (blackPieces === 0 || !blackCanMove) {
        endGame('red');
    }
}

// ===== FUNÇÃO HANDLE PIECE CLICK (COM VERIFICAÇÃO DE CAPTURA) =====
function handlePieceClick(row, col) {
    const piece = gameState.board[row][col];
    if (!piece || piece.color !== gameState.currentTurn) return;
    
    // Verificar se há captura múltipla em andamento
    if (mandatoryCaptureState.hasMandatoryCaptures) {
        if (!mandatoryCaptureState.capturingPiece ||
            row !== mandatoryCaptureState.capturingPiece.row || 
            col !== mandatoryCaptureState.capturingPiece.col) {
            showNotification('Continue capturando com a mesma peça!', 'error');
            return;
        }
    }
    
    // Verificar capturas obrigatórias globais
    const hasGlobalCaptures = checkGlobalMandatoryCaptures();
    
    if (hasGlobalCaptures) {
        const pieceCaptures = getCaptureMoves(row, col, piece, []);
        if (pieceCaptures.length === 0) {
            showNotification('Você deve capturar com outra peça!', 'error');
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

// ===== VERIFICAÇÃO CONTÍNUA DE CAPTURAS =====
setInterval(() => {
    if (gameState && gameState.board && gameState.currentTurn) {
        checkGlobalMandatoryCaptures();
    }
}, 2000);


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

