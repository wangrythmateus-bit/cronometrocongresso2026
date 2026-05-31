require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(__dirname));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Conectado com Sucesso!'))
  .catch(err => console.log('❌ Erro no MongoDB:', err));

// --- MODELOS DO BANCO DE DADOS ---

// Tabela de Discursos
const discursoSchema = new mongoose.Schema({
    tema: String,
    orador: String,
    tempoMinutos: Number,
    dia: String
});
const Discurso = mongoose.model('Discurso', discursoSchema);

// Tabela de Usuários (Login)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'membro'], default: 'membro' }
});
const User = mongoose.model('User', userSchema);

// --- CRIAR ADMINISTRADOR PADRÃO (Automático) ---
async function criarAdminPadrao() {
    const totalUsuarios = await User.countDocuments();
    if (totalUsuarios === 0) {
        const senhaCriptografada = await bcrypt.hash('admin123', 10);
        const admin = new User({ username: 'admin', password: senhaCriptografada, role: 'admin' });
        await admin.save();
        console.log('👑 Usuário Admin padrão criado! (Login: admin / Senha: admin123)');
    }
}
criarAdminPadrao();

// --- WEBSOCKETS (Cronômetro) ---
io.on('connection', (socket) => {
    socket.on('update_timer', (data) => {
        io.emit('sync_display', data);
    });
});

// --- ROTAS DA API ---

// ROTA DE LOGIN (Nova)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Procura o usuário
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: 'Usuário não encontrado!' });

        // Verifica a senha
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Senha incorreta!' });

        // Gera a "Pulseira VIP" (Token)
        const chaveSecreta = process.env.JWT_SECRET || 'ChaveSuperSecretaCongresso2026';
        const token = jwt.sign({ id: user._id, role: user.role }, chaveSecreta, { expiresIn: '12h' });
        
        res.json({ token, role: user.role });
    } catch (err) {
        res.status(500).json({ error: 'Erro no servidor durante o login' });
    }
});

// Ler discursos
app.get('/api/discursos', async (req, res) => {
    try {
        const discursos = await Discurso.find();
        res.json(discursos);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar discursos' });
    }
});

// Adicionar discurso
app.post('/api/discursos', async (req, res) => {
    try {
        const novoDiscurso = new Discurso(req.body);
        await novoDiscurso.save();
        res.json(novoDiscurso);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar discurso' });
    }
});

// Apagar discurso
app.delete('/api/discursos/:id', async (req, res) => {
    try {
        await Discurso.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao apagar discurso' });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando! Acesse: http://localhost:${PORT}`);
});
