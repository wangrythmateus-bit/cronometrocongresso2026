require('dotenv').config();
const mongoose = require('mongoose');
// Conectando ao Banco de Dados MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Conectado com Sucesso!'))
  .catch(err => console.log('❌ Erro no MongoDB:', err));
app.use(express.json());
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');


const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Uma tela foi conectada.');
    
    socket.on('update_timer', (data) => {
        io.emit('sync_display', data);
    });
});
// --- MODELO DO BANCO DE DADOS (MONGOOSE) ---
const discursoSchema = new mongoose.Schema({
    tema: String,
    orador: String,
    tempoMinutos: Number,
    dia: String
});
const Discurso = mongoose.model('Discurso', discursoSchema);

// --- ROTAS DA API ---
// 1. Ler todos os discursos
app.get('/api/discursos', async (req, res) => {
    try {
        const discursos = await Discurso.find();
        res.json(discursos);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar discursos' });
    }
});

// 2. Adicionar um novo discurso
app.post('/api/discursos', async (req, res) => {
    try {
        const novoDiscurso = new Discurso(req.body);
        await novoDiscurso.save();
        res.json(novoDiscurso);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar discurso' });
    }
});

// 3. Apagar um discurso
app.delete('/api/discursos/:id', async (req, res) => {
    try {
        await Discurso.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao apagar discurso' });
    }
});
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando! Acesse: http://localhost:${PORT}`);
});
