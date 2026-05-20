const { Server } = require('socket.io');

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    // Unirse a sala según el rol (enviado desde el frontend al conectar)
    socket.on('join', (rol) => {
      if (rol) socket.join(rol);
      console.log(`  → Unido a sala: ${rol}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io no ha sido inicializado');
  return io;
}

module.exports = { initSocket, getIO };
