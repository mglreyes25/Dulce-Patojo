const supabase = require('../config/database');

// ── LISTAR PEDIDOS ──────────────────────────────────────────────
const obtenerPedidos = async (req, res) => {
  try {
    const { estado, fecha, limite } = req.query;
    let query = supabase
      .from('pedidos')
      .select('*, usuarios(nombre), mesa:mesas(numero), pedido_items(*)')
      .order('creado_en', { ascending: false });

    if (estado) query = query.eq('estado', estado);
    if (fecha) query = query.gte('creado_en', fecha + 'T00:00:00Z').lte('creado_en', fecha + 'T23:59:59Z');
    if (limite) query = query.limit(Number(limite));

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('Error obteniendo pedidos:', e);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
};

// ── OBTENER PEDIDO POR ID ────────────────────────────────────────
const obtenerPedidoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, usuarios(nombre), mesa:mesas(numero), pedido_items(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(data);
  } catch (e) {
    console.error('Error obteniendo pedido:', e);
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
};

// ── OBTENER PRÓXIMO NÚMERO DE TICKET ─────────────────────────────
const obtenerProximoTicket = async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('tickets')
      .select('contador_diario')
      .eq('fecha', hoy)
      .order('contador_diario', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const proximo = (data?.contador_diario || 0) + 1;
    res.json({ numero_ticket: proximo });
  } catch (e) {
    console.error('Error obteniendo próximo ticket:', e);
    res.status(500).json({ error: 'Error al obtener próximo ticket' });
  }
};

// ── CREAR PEDIDO ────────────────────────────────────────────────
const crearPedido = async (req, res) => {
  const { items, tipo, mesa_id, cliente_nombre, notas, promociones_aplicadas } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'El pedido debe tener al menos un item' });
  }
  if (!['para_llevar', 'en_mesa', 'para_recoger'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de pedido inválido' });
  }
  if (tipo === 'en_mesa' && !mesa_id) {
    return res.status(400).json({ error: 'Debe seleccionar una mesa para pedidos en mesa' });
  }

  try {
    // Calcular subtotal y descuentos
    let subtotal = 0;
    items.forEach(item => {
      subtotal += Number(item.precio) * Number(item.cantidad);
    });

    const descuento = Number(promociones_aplicadas?.reduce((sum, p) => sum + Number(p.monto || 0), 0) || 0);
    const total = Math.max(0, subtotal - descuento);

    // Obtener próximo número de ticket
    const hoy = new Date().toISOString().split('T')[0];
    const { data: lastTicket } = await supabase
      .from('tickets')
      .select('contador_diario')
      .eq('fecha', hoy)
      .order('contador_diario', { ascending: false })
      .limit(1)
      .maybeSingle();
    const numeroTicket = (lastTicket?.contador_diario || 0) + 1;

    // Crear pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        numero_ticket: numeroTicket,
        tipo, mesa_id: mesa_id || null,
        cliente_nombre: cliente_nombre || null,
        estado: 'recibido',
        subtotal, descuento, total,
        usuario_id: req.user.id,
        notas: notas || null,
      })
      .select()
      .single();

    if (pedidoError) throw pedidoError;

    // Insertar items del pedido
    const itemsInsert = items.map(item => ({
      pedido_id: pedido.id,
      producto_id: item.tipo === 'producto' ? item.id : null,
      combo_id: item.tipo === 'combo' ? item.id : null,
      promocion_id: item.tipo === 'promocion' ? item.id : null,
      tipo_item: item.tipo,
      nombre: item.nombre,
      cantidad: Number(item.cantidad),
      precio_unitario: Number(item.precio),
      notas: item.notas || null,
    }));

    const { error: itemsError } = await supabase
      .from('pedido_items')
      .insert(itemsInsert);

    if (itemsError) throw itemsError;

    // Registrar ticket
    await supabase.from('tickets').insert({
      pedido_id: pedido.id,
      numero_ticket: numeroTicket,
      fecha: hoy,
      contador_diario: numeroTicket,
    });

    // Si tiene mesa, marcarla como ocupada
    if (mesa_id) {
      await supabase.from('mesas').update({ estado: 'ocupada' }).eq('id', mesa_id);
    }

    // Bitácora
    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id, accion: 'CREAR_PEDIDO',
      descripcion: `Pedido #${numeroTicket} — ${items.length} item(s), total: $${total}`,
    });

    // Retornar pedido completo con items
    const { data: pedidoCompleto } = await supabase
      .from('pedidos')
      .select('*, pedido_items(*)')
      .eq('id', pedido.id)
      .single();

    res.status(201).json(pedidoCompleto);
  } catch (e) {
    console.error('Error creando pedido:', e);
    res.status(500).json({ error: 'Error al crear pedido' });
  }
};

// ── CAMBIAR ESTADO DEL PEDIDO ──────────────────────────────────
const cambiarEstadoPedido = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  const estadosValidos = ['recibido', 'en_preparacion', 'listo', 'entregado', 'pagado', 'cancelado'];

  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Use: ${estadosValidos.join(', ')}` });
  }

  try {
    const { data: pedido, error: getError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', id)
      .single();
    if (getError || !pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado, actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .select('*, pedido_items(*)')
      .single();
    if (error) throw error;

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id, accion: 'ESTADO_PEDIDO',
      descripcion: `Pedido #${pedido.numero_ticket}: ${pedido.estado} → ${estado}`,
    });

    res.json(data);
  } catch (e) {
    console.error('Error cambiando estado:', e);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
};

// ── PROCESAR PAGO ──────────────────────────────────────────────
const procesarPago = async (req, res) => {
  const { id } = req.params;
  const { metodo_pago: metodo, monto_recibido } = req.body;

  if (!['efectivo', 'tarjeta'].includes(metodo)) {
    return res.status(400).json({ error: 'Método de pago inválido. Use: efectivo, tarjeta' });
  }

  try {
    const { data: pedido, error: getError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', id)
      .single();
    if (getError || !pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (pedido.estado === 'pagado') return res.status(400).json({ error: 'El pedido ya está pagado' });
    if (pedido.estado === 'cancelado') return res.status(400).json({ error: 'El pedido está cancelado' });

    const total = Number(pedido.total);
    const recibido = metodo === 'efectivo' ? Number(monto_recibido) : total;

    if (metodo === 'efectivo' && Number(monto_recibido) < total) {
      return res.status(400).json({ error: `Monto insuficiente. Total: $${total}, Recibido: $${monto_recibido}` });
    }

    const cambio = Math.max(0, recibido - total);

    // Registrar pago
    const { data: pago, error: pagoError } = await supabase
      .from('pagos')
      .insert({
        pedido_id: Number(id),
        metodo, monto_recibido: recibido, cambio, total,
        usuario_id: req.user.id,
      })
      .select()
      .single();
    if (pagoError) throw pagoError;

    // Actualizar estado del pedido
    const { data: pedidoActualizado } = await supabase
      .from('pedidos')
      .update({ estado: 'pagado', actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .select('*, pedido_items(*)')
      .single();

    // Liberar mesa si el pedido es en mesa
    if (pedido.mesa_id) {
      await supabase.from('mesas').update({ estado: 'disponible' }).eq('id', pedido.mesa_id);
    }

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id, accion: 'PAGO',
      descripcion: `Pago pedido #${pedido.numero_ticket} — ${metodo} — $${total}`,
    });

    res.json({ pedido: pedidoActualizado, pago });
  } catch (e) {
    console.error('Error procesando pago:', e);
    res.status(500).json({ error: 'Error al procesar pago' });
  }
};

// ── OBTENER TICKET ─────────────────────────────────────────────
const obtenerTicket = async (req, res) => {
  const { id } = req.params;
  try {
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select('*, pedido_items(*), pagos(*), usuarios(nombre)')
      .eq('id', id)
      .single();
    if (error || !pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const ticket = {
      numero: pedido.numero_ticket,
      fecha: pedido.creado_en,
      items: pedido.pedido_items,
      subtotal: pedido.subtotal,
      descuento: pedido.descuento,
      total: pedido.total,
      tipo: pedido.tipo,
      cliente: pedido.cliente_nombre,
      mesa: pedido.mesa_id,
      pago: pedido.pagos?.[0] || null,
      cajero: pedido.usuarios?.nombre || '',
    };

    res.json(ticket);
  } catch (e) {
    console.error('Error obteniendo ticket:', e);
    res.status(500).json({ error: 'Error al obtener ticket' });
  }
};

// ── REIMPRIMIR TICKET ──────────────────────────────────────────
const reimprimirTicket = async (req, res) => {
  return obtenerTicket(req, res);
};

module.exports = {
  obtenerPedidos, obtenerPedidoPorId, obtenerProximoTicket,
  crearPedido, cambiarEstadoPedido,
  procesarPago, obtenerTicket, reimprimirTicket,
};
