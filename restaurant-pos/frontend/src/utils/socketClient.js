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
  if (sharedSocket && sharedSocket.connected) {
    try {
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      if (usuario.id) {
        sharedSocket.emit('force-logout', { userId: usuario.id });
      }
    } catch {}
    sharedSocket.disconnect();
  }
  sharedSocket = null;
  socketRefCount = 0;
}

export function incRef() { socketRefCount++; }
export function decRef() { socketRefCount--; }
