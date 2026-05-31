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
const discursoSchema = new mongoose.Schema({
    tema: String,
    orador: String,
    tempoMinutos: Number,
    dia: String
});
const Discurso = mongoose.model('Discurso', discursoSchema);

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'membro'], default: 'membro' }
});
const User = mongoose.model('User', userSchema);

async function criarAdminPadrao() {
    const totalUsuarios = await User.countDocuments();
    if (totalUsuarios === 0) {
        const senhaCriptografada = await bcrypt.hash('admin123', 10);
        const admin = new User({ username: 'admin', password: senhaCriptografada, role: 'admin' });
        await admin.save();
        console.log('👑 Usuário Admin padrão criado!');
    }
}
criarAdminPadrao();

io.on('connection', (socket) => {
    socket.on('update_timer', (data) => {
        io.emit('sync_display', data);
    });
});

// --- SEGURANÇA: VERIFICAR PULSEIRA VIP (MIDDLEWARE) ---
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Pega só o código após a palavra "Bearer"
    
    if (!token) return res.status(401).json({ error: 'Acesso negado. Faça login.' });

    const chaveSecreta = process.env.JWT_SECRET || 'ChaveSuperSecretaCongresso2026';
    jwt.verify(token, chaveSecreta, (err, user) => {
        if (err) return res.status(403).json({ error: 'Sessão expirada ou inválida.' });
        req.user = user; // Salva quem é o usuário que está fazendo o pedido
        next(); // Libera a passagem
    });
}

// --- ROTAS DA API ---

// 1. Fazer Login (Não precisa de token para entrar aqui)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: 'Usuário não encontrado!' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Senha incorreta!' });

        const chaveSecreta = process.env.JWT_SECRET || 'ChaveSuperSecretaCongresso2026';
        const token = jwt.sign({ id: user._id, role: user.role }, chaveSecreta, { expiresIn: '12h' });
        
        res.json({ token, role: user.role });
    } catch (err) {
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// 2. Criar novo usuário (Apenas Admin pode acessar)
app.post('/api/usuarios', verificarToken, async (req, res) => {
    // Se não for admin, é barrado na hora
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas administradores podem criar usuários.' });
    }

    try {
        const { username, password, role } = req.body;
        const userExiste = await User.findOne({ username });
        if (userExiste) return res.status(400).json({ error: 'Esse nome de usuário já existe!' });

        const senhaCriptografada = await bcrypt.hash(password, 10);
        const novoUser = new User({ username, password: senhaCriptografada, role });
        await novoUser.save();
        
        res.json({ message: 'Usuário criado com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao criar usuário.' });
    }
});

// 3. Rotas de Discursos (Protegidas pelo verificarToken)
app.get('/api/discursos', verificarToken, async (req, res) => {
    try {
        const discursos = await Discurso.find();
        res.json(discursos);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar' });
    }
});

app.post('/api/discursos', verificarToken, async (req, res) => {
    try {
        const novoDiscurso = new Discurso(req.body);
        await novoDiscurso.save();
        res.json(novoDiscurso);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar' });
    }
});

// Apenas Admin pode apagar discursos
app.delete('/api/discursos/:id', verificarToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas administradores podem apagar discursos.' });
    }
    try {
        await Discurso.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao apagar' });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando! Acesse: http://localhost:${PORT}`);
});
