import { useEffect, useRef } from 'react';
import { SOCKET_URL } from '../utils/api';
import useSocket from './useSocket';

export default function useCobrosSocket({
  onCobroIniciado,
  onBloqueoLiberado,
  onPedidoPagado,
  onNuevoPedidoCobrable,
  onCambioEstado,
}) {
  const handlersRef = useRef({ onCobroIniciado, onBloqueoLiberado, onPedidoPagado, onNuevoPedidoCobrable, onCambioEstado });
  handlersRef.current = { onCobroIniciado, onBloqueoLiberado, onPedidoPagado, onNuevoPedidoCobrable, onCambioEstado };

  useSocket({
    cobro_iniciado: (data) => handlersRef.current.onCobroIniciado?.(data),
    bloqueo_liberado: (data) => handlersRef.current.onBloqueoLiberado?.(data),
    pedido_pagado: (data) => handlersRef.current.onPedidoPagado?.(data),
    cambio_estado: (data) => {
      handlersRef.current.onCambioEstado?.(data);
      if (data.estado === 'listo') {
        handlersRef.current.onNuevoPedidoCobrable?.(data);
      }
    },
  });
}
