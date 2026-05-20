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

module.exports = { emitNuevoPedido, emitCambioEstado, emitPedidoListo };
