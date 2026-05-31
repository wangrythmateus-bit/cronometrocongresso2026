require('dotenv').config();
const mongoose = require('mongoose');
// Conectando ao Banco de Dados MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Conectado com Sucesso!'))
  .catch(err => console.log('❌ Erro no MongoDB:', err));
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

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando! Acesse: http://localhost:${PORT}`);
});