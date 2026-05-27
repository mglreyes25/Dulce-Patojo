import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/api';

let sharedSocket = null;
let socketRefCount = 0;

function getSocket() {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return sharedSocket;
}

export default function useSocket(eventHandlers = {}) {
  const socketRef = useRef(null);
  const handlersRef = useRef(eventHandlers);
  handlersRef.current = eventHandlers;

  useEffect(() => {
    socketRefCount++;
    const socket = getSocket();
    socketRef.current = socket;

    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (socket.connected && usuario.rol) {
      socket.emit('join', usuario.rol);
    }
    socket.on('connect', () => {
      if (usuario.rol) socket.emit('join', usuario.rol);
    });

    const boundHandlers = {};
    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      const bound = (...args) => handlersRef.current[event]?.(...args);
      boundHandlers[event] = bound;
      socket.on(event, bound);
    });

    return () => {
      Object.entries(boundHandlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
      socketRefCount--;
    };
  }, []);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socket: socketRef, emit };
}
