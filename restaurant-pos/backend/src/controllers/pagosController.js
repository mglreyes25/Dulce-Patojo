const supabase = require('../config/database');
const { emitPedidoPagado } = require('../config/socketEmitter');

const registrarPago = async (req, res) => {
  const { pedido_id, metodo_pago: metodo, monto_recibido, propina } = req.body;

  if (!pedido_id) {
    return res.status(400).json({ error: 'pedido_id es requerido' });
  }
  if (!['efectivo', 'tarjeta', 'qr', 'billetera_digital', 'transferencia'].includes(metodo)) {
    return res.status(400).json({ error: 'Método de pago inválido' });
  }

  try {
    const { data: pedido, error: getError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedido_id)
      .single();
    if (getError || !pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (pedido.estado === 'pagado') return res.status(400).json({ error: 'El pedido ya está pagado' });
    if (pedido.estado === 'cancelado') return res.status(400).json({ error: 'El pedido está cancelado' });

    const total = Number(pedido.total_con_iva || pedido.total);
    const recibo = metodo === 'efectivo' ? Number(monto_recibido) : total;
    const tip = Math.max(0, Number(propina || 0));
    const totalConPropina = total + tip;

    if (metodo === 'efectivo' && Number(monto_recibido) < totalConPropina) {
      return res.status(400).json({ error: `Monto insuficiente. Total: $${totalConPropina.toFixed(2)}, Recibido: $${monto_recibido}` });
    }

    const cambio = Math.max(0, recibo - totalConPropina);

    const pagoBase = {
      pedido_id: Number(pedido_id),
      metodo, monto_recibido: recibo, cambio,
      total, usuario_id: req.user.id,
    };
    const pagoCompleto = {
      ...pagoBase,
      propina: tip,
      iva: pedido.iva || 0,
      subtotal_sin_iva: pedido.subtotal || 0,
      total_con_iva: total,
    };

    let pago, pagoError;
    const tryPagoInsert = (fields) =>
      supabase.from('pagos').insert(fields).select().single();

    const pagoResult = await tryPagoInsert(pagoCompleto);
    if (!pagoResult.error) {
      pago = pagoResult.data;
    } else {
      const fallback = await tryPagoInsert(pagoBase);
      pago = fallback.data;
      pagoError = fallback.error;
    }
    if (pagoError) throw pagoError;

    const { data: pedidoActualizado } = await supabase
      .from('pedidos')
      .update({ estado: 'pagado', actualizado_en: new Date().toISOString() })
      .eq('id', pedido_id)
      .select('*, pedido_items(*)')
      .single();

    if (pedido.mesa_id) {
      await supabase.from('mesas').update({ estado: 'disponible' }).eq('id', pedido.mesa_id);
    }

    try {
      await supabase.from('bitacora_permisos').insert({
        usuario_id: req.user.id, accion: 'PAGO',
        descripcion: `Pago pedido #${pedido.numero_ticket} — ${metodo} — $${total}${tip > 0 ? ` + $${tip} propina` : ''}`,
      });
    } catch (logErr) {
      console.error('Error registrando en bitacora_permisos:', logErr);
    }

    if (pedidoActualizado) emitPedidoPagado(pedidoActualizado);

    res.json({ pedido: pedidoActualizado, pago });
  } catch (e) {
    console.error('Error registrando pago:', e);
    res.status(500).json({ error: 'Error al registrar pago', detalle: e.message });
  }
};

module.exports = { registrarPago };
