const supabase = require('../config/database');
const { emitNuevoPedido, emitCambioEstado, emitPedidoListo } = require('../config/socketEmitter');

// ── HELPER: Descontar stock de ingredientes por receta ──────────
const descontarStockPorReceta = async (productoId, cantidad, descripcion, usuarioId) => {
  try {
    const { data: recetas } = await supabase
      .from('recetas')
      .select('*, ingredientes(nombre)')
      .eq('producto_id', productoId);

    if (recetas && recetas.length > 0) {
      for (const r of recetas) {
        const resta = Number(r.cantidad) * Number(cantidad);
        const { data: ing } = await supabase
          .from('ingredientes')
          .select('stock')
          .eq('id', r.ingrediente_id)
          .single();

        if (ing) {
          const stockAnterior = Number(ing.stock);
          const stockNuevo = Math.max(0, stockAnterior - resta);

          await supabase.from('ingredientes')
            .update({ stock: stockNuevo, actualizado_en: new Date().toISOString() })
            .eq('id', r.ingrediente_id);

          await supabase.from('movimientos_ingredientes').insert({
            ingrediente_id: r.ingrediente_id,
            tipo: 'salida',
            cantidad: resta,
            stock_anterior: stockAnterior,
            stock_nuevo: stockNuevo,
            descripcion: `${descripcion} — ${r.ingredientes?.nombre || ''}`,
            referencia_tipo: 'pedido',
            usuario_id: usuarioId,
          });
        }
      }
    }
  } catch (e) {
    console.error(`Error descontando stock por receta (producto ${productoId}):`, e);
  }
};

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

    if (estado) {
      const estados = estado.split(',').map(s => s.trim()).filter(Boolean);
      if (estados.length === 1) query = query.eq('estado', estados[0]);
      else query = query.in('estado', estados);
    }
    if (fecha) query = query.gte('creado_en', fecha + 'T00:00:00Z').lte('creado_en', fecha + 'T23:59:59Z');
    if (limite) query = query.limit(Number(limite));

    const { data, error } = await query;
    if (error) {
      // Fallback: query sin joins si hay problemas de schema cache
      const { data: fallback } = await supabase.from('pedidos').select('*').order('creado_en', { ascending: false });
      return res.json(fallback || []);
    }
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
    // 'domicilio' requiere migracion_iva.sql ejecutada en Supabase
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
    const baseImponible = Math.max(0, subtotal - descuento);

    // Obtener tasa de IVA activa
    const { data: ivaReg } = await supabase
      .from('impuestos').select('tasa').eq('activo', true).limit(1).maybeSingle();
    const ivaTasa = ivaReg ? Number(ivaReg.tasa) : 0.13;

    // Calcular IVA: si el item tiene exento_iva, no se le aplica
    let iva = 0;
    for (const item of items) {
      const { data: prod } = await supabase
        .from('productos').select('exento_iva').eq('id', item.id).maybeSingle();
      if (!prod?.exento_iva) {
        iva += Number(item.precio) * Number(item.cantidad) * ivaTasa;
      }
    }
    iva = Math.round(iva * 100) / 100;
    const totalConIva = baseImponible + iva;

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

    // Crear pedido (con soporte para columnas IVA si existen en la DB)
    const pedidoInsert = {
      numero_ticket: numeroTicket,
      tipo, mesa_id: mesa_id || null,
      cliente_nombre: cliente_nombre || null,
      estado: 'recibido',
      subtotal, descuento, total: baseImponible,
      usuario_id: req.user.id,
      notas: notas || null,
    };

    let pedido, pedidoError;
    const tryInsert = (extraFields) =>
      supabase.from('pedidos').insert({ ...pedidoInsert, ...extraFields }).select().single();

    // Intentar con IVA; si falla, insertar sin IVA
    const ivaResult = await tryInsert({ iva, total_con_iva: totalConIva });
    if (!ivaResult.error) {
      pedido = ivaResult.data;
    } else {
      const fallback = await tryInsert({});
      pedido = fallback.data;
      pedidoError = fallback.error;
    }

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

    // ── Ocupar mesa (dentro del try-catch para rollback) ─────────
    if (mesa_id) {
      const { error: mesaError } = await supabase
        .from('mesas')
        .update({ estado: 'ocupada' })
        .eq('id', mesa_id);
      if (mesaError) console.error('Error al ocupar mesa:', mesaError);
    }

    // ── Descontar stock de productos ──────────────────────────────
    for (const item of items) {
      try {
        if (item.tipo === 'producto') {
          await descontarStock(item.id, item.cantidad, `Venta pedido #${numeroTicket}`, req.user.id);
          await descontarStockPorReceta(item.id, item.cantidad, `Venta pedido #${numeroTicket}`, req.user.id);
        } else if (item.tipo === 'combo') {
          const { data: comboProds } = await supabase
            .from('combo_productos')
            .select('producto_id, cantidad')
            .eq('combo_id', item.id);
          if (comboProds) {
            for (const cp of comboProds) {
              const cant = Number(cp.cantidad) * Number(item.cantidad);
              await descontarStock(cp.producto_id, cant, `Venta combo #${item.id} — pedido #${numeroTicket}`, req.user.id);
              await descontarStockPorReceta(cp.producto_id, cant, `Venta combo #${item.id} — pedido #${numeroTicket}`, req.user.id);
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
            await descontarStockPorReceta(promo.producto_id, Number(item.cantidad), `Venta promoción #${item.id} — pedido #${numeroTicket}`, req.user.id);
          }
        }
      } catch (stockErr) {
        console.error(`Error descontando stock para item ${item.id}:`, stockErr);
      }
    }

    // Bitácora
    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id, accion: 'CREAR_PEDIDO',
      descripcion: `Pedido #${numeroTicket} — ${items.length} item(s), total: $${baseImponible}`,
    });

    // Socket: notificar a cocina
    const { data: pedidoCompleto } = await supabase
      .from('pedidos')
      .select('*, pedido_items(*)')
      .eq('id', pedido.id)
      .single();

    if (pedidoCompleto) emitNuevoPedido(pedidoCompleto);

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

    // Socket: notificar cambio de estado
    emitCambioEstado(id, estado, pedido.numero_ticket);
    if (estado === 'listo') emitPedidoListo({ ...data, numero_ticket: pedido.numero_ticket });

    res.json(data);
  } catch (e) {
    console.error('Error cambiando estado:', e);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
};

// ── PROCESAR PAGO ──────────────────────────────────────────────
const procesarPago = async (req, res) => {
  const { id } = req.params;
  const { metodo_pago: metodo, monto_recibido, propina } = req.body;

  if (!['efectivo', 'tarjeta', 'qr', 'billetera_digital', 'transferencia'].includes(metodo)) {
    return res.status(400).json({ error: 'Método de pago inválido' });
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

    const total = Number(pedido.total_con_iva || pedido.total);
    const recibo = metodo === 'efectivo' ? Number(monto_recibido) : total;
    const tip = Math.max(0, Number(propina || 0));
    const totalConPropina = total + tip;

    if (metodo === 'efectivo' && Number(monto_recibido) < totalConPropina) {
      return res.status(400).json({ error: `Monto insuficiente. Total: $${totalConPropina.toFixed(2)}, Recibido: $${monto_recibido}` });
    }

    const cambio = Math.max(0, recibo - totalConPropina);

    // Registrar pago (con soporte para columnas IVA/propina si existen)
    const pagoBase = {
      pedido_id: Number(id),
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
      descripcion: `Pago pedido #${pedido.numero_ticket} — ${metodo} — $${total}${tip > 0 ? ` + $${tip} propina` : ''}`,
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

// ── RESUMEN PARA DASHBOARD ──────────────────────────────────────
const obtenerResumen = async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];

    const { count: pedidosHoy } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .gte('creado_en', hoy);

    const { data: ventasHoy } = await supabase
      .from('pagos')
      .select('total')
      .gte('creado_en', hoy);

    const ventasTotales = ventasHoy?.reduce((sum, p) => sum + Number(p.total), 0) || 0;

    const { count: prodActivos } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true);

    const { count: usersActivos } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true);

    res.json({
      pedidos_hoy: pedidosHoy || 0,
      ventas_totales: ventasTotales,
      productos_activos: prodActivos || 0,
      usuarios_activos: usersActivos || 0,
    });
  } catch (e) {
    console.error('Error en resumen:', e);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
};

module.exports = {
  obtenerPedidos, obtenerPedidoPorId, obtenerProximoTicket,
  crearPedido, cambiarEstadoPedido,
  procesarPago, obtenerTicket, reimprimirTicket,
  probarMesa, obtenerResumen,
};
