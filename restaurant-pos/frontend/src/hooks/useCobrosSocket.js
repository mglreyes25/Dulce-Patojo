import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/api';

export default function useCobrosSocket({
  onCobroIniciado,
  onBloqueoLiberado,
  onPedidoPagado,
  onNuevoPedidoCobrable,
  onCambioEstado,
}) {
  const socketRef = useRef(null);
  const usuarioRef = useRef(null);

  useEffect(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    usuarioRef.current = usuario;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (usuario.rol) {
        socket.emit('join', usuario.rol);
      }
    });

    socket.on('cobro_iniciado', (data) => {
      if (onCobroIniciado) onCobroIniciado(data);
    });

    socket.on('bloqueo_liberado', (data) => {
      if (onBloqueoLiberado) onBloqueoLiberado(data);
    });

    socket.on('pedido_pagado', (data) => {
      if (onPedidoPagado) onPedidoPagado(data);
    });

    socket.on('cambio_estado', (data) => {
      if (onCambioEstado) onCambioEstado(data);
      if (onNuevoPedidoCobrable && data.estado === 'listo') {
        onNuevoPedidoCobrable(data);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef;
}
