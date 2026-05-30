import { useEffect, useRef, useCallback } from 'react';
import { getSocket, disconnectSocket, incRef, decRef } from '../utils/socketClient';

export { disconnectSocket };

export default function useSocket(eventHandlers = {}) {
  const socketRef = useRef(null);
  const handlersRef = useRef(eventHandlers);
  handlersRef.current = eventHandlers;

  useEffect(() => {
    incRef();
    const socket = getSocket();
    socketRef.current = socket;

    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (socket.connected && usuario.rol) {
      socket.emit('join', { rol: usuario.rol, userId: usuario.id });
    }
    socket.on('connect', () => {
      if (usuario.rol) socket.emit('join', { rol: usuario.rol, userId: usuario.id });
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
      decRef();
    };
  }, []);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socket: socketRef, emit };
}
