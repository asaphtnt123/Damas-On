// admin-firebase.js - Integração com Firebase
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
const db = firebase.firestore();

// Funções reais para buscar dados do Firebase
async function fetchRealEarningsData(period) {
    try {
        let query = db.collection('platformEarnings').orderBy('timestamp', 'desc');
        
        // Aplicar filtro de período
        if (period !== 'all') {
            const now = new Date();
            let startDate;
            
            switch(period) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                    break;
            }
            
            if (startDate) {
                query = query.where('timestamp', '>=', startDate);
            }
        }
        
        const snapshot = await query.get();
        
        let totalEarnings = 0;
        let totalBets = 0;
        let earningsByDate = {};
        let distribution = {
            'Normal': 0,
            'Desistência': 0,
            'Tempo Esgotado': 0
        };
        
        const transactions = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            totalEarnings += data.amount;
            totalBets += data.betAmount;
            
            // Agrupar por data
            const date = data.timestamp.toDate().toLocaleDateString('pt-BR');
            earningsByDate[date] = (earningsByDate[date] || 0) + data.amount;
            
            // Distribuição por tipo
            if (data.surrendered) {
                distribution['Desistência']++;
            } else if (data.timeout) {
                distribution['Tempo Esgotado']++;
            } else {
                distribution['Normal']++;
            }
            
            // Transações para a tabela
            transactions.push({
                id: doc.id,
                date: data.timestamp.toDate().toLocaleString('pt-BR'),
                tableId: data.tableId,
                betAmount: data.betAmount,
                platformFee: data.amount,
                winner: data.winner,
                type: data.surrendered ? 'Desistência' : data.timeout ? 'Tempo Esgotado' : 'Normal'
            });
        });
        
        return {
            totalEarnings,
            totalTransactions: snapshot.size,
            totalBets,
            averagePerGame: snapshot.size > 0 ? totalEarnings / snapshot.size : 0,
            earningsByDate,
            distribution,
            transactions
        };
        
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        throw error;
    }
}

// Função para carregar usuários
async function fetchUsers(sortBy = 'coins') {
    try {
        let query = db.collection('users').orderBy(sortBy, 'desc');
        const snapshot = await query.limit(50).get();
        
        const users = [];
        snapshot.forEach(doc => {
            const user = { id: doc.id, ...doc.data() };
            users.push(user);
        });
        
        return users;
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        throw error;
    }
}