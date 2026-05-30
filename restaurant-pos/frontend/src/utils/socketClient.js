import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || undefined;

let sharedSocket = null;
let socketRefCount = 0;

export function getSocket() {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return sharedSocket;
}

export function disconnectSocket() {
  const socket = sharedSocket;
  sharedSocket = null;
  socketRefCount = 0;

  if (socket && socket.connected) {
    try {
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      if (usuario.id) {
        socket.emit('force-logout', { userId: usuario.id });
      }
    } catch {}
    setTimeout(() => socket.disconnect(), 300);
  }
}

export function incRef() { socketRefCount++; }
export function decRef() { socketRefCount--; }
