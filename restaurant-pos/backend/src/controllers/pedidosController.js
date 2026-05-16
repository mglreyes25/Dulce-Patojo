const supabase = require('../config/database');

// ── HELPER: Descontar stock de un producto ──────────────────────
const descontarStock = async (productoId, cantidad, descripcion, usuarioId) => {
  const { data: prod } = await supabase
    .from('productos')
    .select('id, nombre, stock')
    .eq('id', productoId)
    .single();

  if (!prod) return;

  const stockAnterior = prod.stock || 0;
  const stockNuevo = Math.max(0, stockAnterior - Number(cantidad));

  await supabase
    .from('productos')
    .update({ stock: stockNuevo, actualizado_en: new Date().toISOString() })
    .eq('id', productoId);

  await supabase
    .from('inventario_movimientos')
    .insert({
      producto_id: productoId,
      tipo: 'salida',
      cantidad: Number(cantidad),
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo,
      descripcion: descripcion || `Salida de ${cantidad} unidad(es)`,
      usuario_id: usuarioId,
    });
};

// ── HELPER: Reponer stock de un producto (para cancelaciones) ──
const reponerStock = async (productoId, cantidad, descripcion, usuarioId) => {
  const { data: prod } = await supabase
    .from('productos')
    .select('id, nombre, stock')
    .eq('id', productoId)
    .single();

  if (!prod) return;

  const stockAnterior = prod.stock || 0;
  const stockNuevo = stockAnterior + Number(cantidad);

  await supabase
    .from('productos')
    .update({ stock: stockNuevo, actualizado_en: new Date().toISOString() })
    .eq('id', productoId);

  await supabase
    .from('inventario_movimientos')
    .insert({
      producto_id: productoId,
      tipo: 'entrada',
      cantidad: Number(cantidad),
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo,
      descripcion: descripcion || `Reposición de ${cantidad} unidad(es)`,
      usuario_id: usuarioId,
    });
};

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

  // ── Ocupar mesa INMEDIATAMENTE como operación independiente ──
  if (mesa_id) {
    const apiUrl = process.env.SUPABASE_URL;
    const apiKey = process.env.SUPABASE_KEY;
    console.log(`🪑 [DIRECTO] Ocupando mesa ID ${mesa_id}...`);
    const resp = await fetch(`${apiUrl}/rest/v1/mesas?id=eq.${mesa_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ estado: 'ocupada' }),
    });
    const result = await resp.json();
    console.log(`📦 [DIRECTO] Resultado mesa update:`, JSON.stringify(result));
    if (!resp.ok) {
      console.error('❌ [DIRECTO] Error al ocupar mesa:', result);
    } else {
      console.log('✅ [DIRECTO] Mesa ocupada correctamente');
    }
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
    const { error: ticketError } = await supabase.from('tickets').insert({
      pedido_id: pedido.id,
      numero_ticket: numeroTicket,
      fecha: hoy,
      contador_diario: numeroTicket,
    });
    if (ticketError) console.error('Error registrando ticket:', ticketError);

    // ── Descontar stock de productos ──────────────────────────────
    for (const item of items) {
      try {
        if (item.tipo === 'producto') {
          await descontarStock(item.id, item.cantidad, `Venta pedido #${numeroTicket}`, req.user.id);
        } else if (item.tipo === 'combo') {
          const { data: comboProds } = await supabase
            .from('combo_productos')
            .select('producto_id, cantidad')
            .eq('combo_id', item.id);
          if (comboProds) {
            for (const cp of comboProds) {
              const cant = Number(cp.cantidad) * Number(item.cantidad);
              await descontarStock(cp.producto_id, cant, `Venta combo #${item.id} — pedido #${numeroTicket}`, req.user.id);
            }
          }
        } else if (item.tipo === 'promocion') {
          const { data: promo } = await supabase
            .from('promociones')
            .select('producto_id')
            .eq('id', item.id)
            .maybeSingle();
          if (promo?.producto_id) {
            await descontarStock(promo.producto_id, Number(item.cantidad), `Venta promoción #${item.id} — pedido #${numeroTicket}`, req.user.id);
          }
        }
      } catch (stockErr) {
        console.error(`Error descontando stock para item ${item.id}:`, stockErr);
      }
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

    // ── Restaurar stock si se cancela el pedido ──
    if (estado === 'cancelado' && pedido.estado !== 'cancelado' && data.pedido_items) {
      for (const item of data.pedido_items) {
        try {
          if (item.tipo_item === 'producto' && item.producto_id) {
            await reponerStock(item.producto_id, item.cantidad, `Cancelación pedido #${pedido.numero_ticket}`, req.user.id);
          } else if (item.tipo_item === 'combo' && item.combo_id) {
            const { data: comboProds } = await supabase
              .from('combo_productos')
              .select('producto_id, cantidad')
              .eq('combo_id', item.combo_id);
            if (comboProds) {
              for (const cp of comboProds) {
                const cant = Number(cp.cantidad) * Number(item.cantidad);
                await reponerStock(cp.producto_id, cant, `Cancelación combo #${item.combo_id} — pedido #${pedido.numero_ticket}`, req.user.id);
              }
            }
          } else if (item.tipo_item === 'promocion' && item.promocion_id) {
            const { data: promo } = await supabase
              .from('promociones')
              .select('producto_id')
              .eq('id', item.promocion_id)
              .maybeSingle();
            if (promo?.producto_id) {
              await reponerStock(promo.producto_id, item.cantidad, `Cancelación promoción #${item.promocion_id} — pedido #${pedido.numero_ticket}`, req.user.id);
            }
          }
        } catch (stockErr) {
          console.error(`Error restaurando stock para item ${item.id}:`, stockErr);
        }
      }
    }

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

// ── DIAGNÓSTICO: probar actualización de mesa directamente ────
const probarMesa = async (req, res) => {
  const { mesa_id } = req.body;
  if (!mesa_id) return res.status(400).json({ error: 'mesa_id requerido' });
  try {
    console.log(`🧪 Probando update de mesa ID ${mesa_id} (type: ${typeof mesa_id})`);
    const { data, error } = await supabase
      .from('mesas')
      .update({ estado: 'pagando' })
      .eq('id', mesa_id)
      .select();
    console.log('🧪 Resultado:', JSON.stringify({ data, error }));
    if (error) return res.status(500).json({ error: error.message, detalle: error });
    res.json({ message: 'Update ejecutado', data, mesa_id, tipo: typeof mesa_id });
  } catch (e) {
    console.error('🧪 Error en probarMesa:', e);
    res.status(500).json({ error: e.message });
  }
};

module.exports = {
  obtenerPedidos, obtenerPedidoPorId, obtenerProximoTicket,
  crearPedido, cambiarEstadoPedido,
  procesarPago, obtenerTicket, reimprimirTicket,
  probarMesa,
};
