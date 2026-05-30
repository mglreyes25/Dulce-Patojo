const { Server } = require('socket.io');
const { removeSession } = require('./sessionManager');

let io = null;

const userSockets = {};
const onlineUsers = new Set();

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
    transports: ['websocket', 'polling'],
    pingInterval: 15000,
    pingTimeout: 30000,
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    socket.on('join', ({ rol, userId } = {}) => {
      if (rol) socket.join(rol);
      if (userId) {
        if (!userSockets[userId]) userSockets[userId] = new Set();
        userSockets[userId].add(socket.id);
        onlineUsers.add(userId);
        io.emit('usuarios-online', [...onlineUsers]);
      }
      console.log(`  → Unido a sala: ${rol || 'sin rol'} (userId: ${userId || 'anon'})`);
    });

    socket.on('force-logout', ({ userId } = {}) => {
      console.log(`🚪 Logout forzado: userId ${userId}`);
      if (userId) {
        removeSession(userId);
        if (userSockets[userId]) {
          delete userSockets[userId];
          onlineUsers.delete(userId);
          io.emit('usuarios-online', [...onlineUsers]);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Cliente desconectado: ${socket.id}`);
      for (const [userId, sockets] of Object.entries(userSockets)) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            delete userSockets[userId];
            onlineUsers.delete(userId);
          }
          io.emit('usuarios-online', [...onlineUsers]);
          break;
        }
      }
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io no ha sido inicializado');
  return io;
}

function getOnlineUsers() {
  return [...onlineUsers];
}

module.exports = { initSocket, getIO, getOnlineUsers };
