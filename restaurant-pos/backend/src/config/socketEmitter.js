const { getIO } = require('./socket');

function emitNuevoPedido(pedido) {
  try {
    const io = getIO();
    io.to('Cocinero').emit('nuevo_pedido', pedido);
    console.log(`📡 Socket emit: nuevo_pedido #${pedido.numero_ticket}`);
  } catch (e) {
    // Socket no disponible
  }
}

function emitCambioEstado(pedidoId, estado, numeroTicket) {
  try {
    const io = getIO();
    io.emit('cambio_estado', { pedido_id: pedidoId, estado, numero_ticket: numeroTicket });
    console.log(`📡 Socket emit: cambio_estado #${numeroTicket} → ${estado}`);
  } catch (e) {
    // Socket no disponible
  }
}

function emitPedidoListo(pedido) {
  try {
    const io = getIO();
    io.to('Despachador').emit('pedido_listo', pedido);
    console.log(`📡 Socket emit: pedido_listo #${pedido.numero_ticket}`);
  } catch (e) {
    // Socket no disponible
  }
}

function emitPedidoPagado(pedido) {
  try {
    const io = getIO();
    io.to('Cajero').emit('pedido_pagado', pedido);
    io.emit('mesa_liberada', { pedido_id: pedido.id, mesa_id: pedido.mesa_id, numero_ticket: pedido.numero_ticket });
    console.log(`📡 Socket emit: pedido_pagado #${pedido.numero_ticket} — mesa ${pedido.mesa_id || 'N/A'} liberada`);
  } catch (e) {
    // Socket no disponible
  }
}

function emitCobroIniciado(data) {
  try {
    const io = getIO();
    io.to('Cajero').emit('cobro_iniciado', data);
    console.log(`📡 Socket emit: cobro_iniciado pedido #${data.pedido_id} por ${data.usuario_nombre}`);
  } catch (e) {
    // Socket no disponible
  }
}

function emitBloqueoLiberado(data) {
  try {
    const io = getIO();
    io.to('Cajero').emit('bloqueo_liberado', data);
    console.log(`📡 Socket emit: bloqueo_liberado pedido #${data.pedido_id}`);
  } catch (e) {
    // Socket no disponible
  }
}

function emitPromocionesActualizadas() {
  try {
    const io = getIO();
    io.emit('promociones_actualizadas');
    console.log('📡 Socket emit: promociones_actualizadas');
  } catch (e) {
    // Socket no disponible
  }
}

module.exports = { emitNuevoPedido, emitCambioEstado, emitPedidoListo, emitPedidoPagado, emitCobroIniciado, emitBloqueoLiberado, emitPromocionesActualizadas };
