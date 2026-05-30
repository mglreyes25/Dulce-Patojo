const supabase = require('../config/database');

function getPeriodoFilter(periodo, fecha_inicio, fecha_fin) {
  const now = new Date();
  let start, end;

  switch (periodo) {
    case 'hoy':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start.getTime() + 86400000);
      break;
    case 'semana':
      start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      end = new Date(start.getTime() + 7 * 86400000);
      break;
    case 'mes':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'custom':
      start = fecha_inicio ? new Date(fecha_inicio) : new Date(0);
      end = fecha_fin ? new Date(fecha_fin + 'T23:59:59') : new Date();
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start.getTime() + 86400000);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

exports.obtenerVentasPorPeriodo = async (req, res) => {
  try {
    const { periodo, fecha_inicio, fecha_fin } = req.query;
    const { start, end } = getPeriodoFilter(periodo, fecha_inicio, fecha_fin);

    let pedidos;
    let queryError;
    const colSets = [
      'id, total, total_con_iva, creado_en, subtotal',
      'id, total, creado_en, subtotal',
    ];
    for (const cols of colSets) {
      const { data, error } = await supabase
        .from('pedidos')
        .select(cols)
        .eq('estado', 'pagado')
        .gte('creado_en', start)
        .lte('creado_en', end)
        .order('creado_en', { ascending: true });
      if (!error) { pedidos = data; break; }
      queryError = error;
    }
    if (!pedidos) {
      console.error('Supabase error en pedidos tras fallback:', queryError);
      throw queryError;
    }

    console.log(`📊 Ventas: ${pedidos.length} pedidos encontrados en rango`);
    const total_ventas = pedidos.reduce((sum, p) => sum + Number(p.total_con_iva || p.total || 0), 0);
    const total_pedidos = pedidos.length;
    const ticket_promedio = total_pedidos > 0 ? total_ventas / total_pedidos : 0;

    const ventasPorDia = {};
    pedidos.forEach(p => {
      const dia = p.creado_en?.split('T')[0];
      if (!dia) return;
      if (!ventasPorDia[dia]) ventasPorDia[dia] = { total: 0, pedidos: 0 };
      ventasPorDia[dia].total += Number(p.total_con_iva || p.total || 0);
      ventasPorDia[dia].pedidos += 1;
    });

    const ventas_por_dia = Object.entries(ventasPorDia).map(([fecha, data]) => ({
      fecha,
      total: Math.round(data.total * 100) / 100,
      pedidos: data.pedidos,
    }));

    res.json({ total_ventas, total_pedidos, ticket_promedio, ventas_por_dia });
  } catch (error) {
    console.error('Error en obtenerVentasPorPeriodo:', error);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
};

exports.obtenerProductosMasVendidos = async (req, res) => {
  try {
    const { periodo, limite = 5, fecha_inicio, fecha_fin } = req.query;
    const { start, end } = getPeriodoFilter(periodo || 'semana', fecha_inicio, fecha_fin);

    let detalle;
    let detalleError;
    const prodQueries = [
      () => supabase
        .from('pedido_items')
        .select('producto_id, cantidad, precio_unitario')
        .not('producto_id', 'is', null)
        .gte('creado_en', start)
        .lte('creado_en', end),
      () => supabase
        .from('pedido_items')
        .select('producto_id, cantidad, precio_unitario')
        .not('producto_id', 'is', null)
        .gte('creado_en', start)
        .lte('creado_en', end),
    ];
    for (const q of prodQueries) {
      const { data, error } = await q();
      if (!error) { detalle = data; break; }
      detalleError = error;
    }

    const pedidosEnRango = await supabase
      .from('pedidos')
      .select('id')
      .eq('estado', 'pagado')
      .gte('creado_en', start)
      .lte('creado_en', end);

    if (!pedidosEnRango.error && pedidosEnRango.data) {
      const pedidosIds = pedidosEnRango.data.map(p => p.id);
      if (pedidosIds.length > 0) {
        const { data, error } = await supabase
          .from('pedido_items')
          .select('producto_id, cantidad, precio_unitario')
          .not('producto_id', 'is', null)
          .in('pedido_id', pedidosIds);
        if (!error) detalle = data;
      } else {
        detalle = [];
      }
    }

    if (!detalle) {
      if (detalleError) console.error('Supabase error en pedido_items:', detalleError);
      return res.json([]);
    }

    const agrupado = {};
    for (const d of detalle) {
      const pid = d.producto_id;
      if (pid == null) continue;
      if (!agrupado[pid]) {
        agrupado[pid] = { producto_id: pid, cantidad_total: 0, total_vendido: 0 };
      }
      agrupado[pid].cantidad_total += Number(d.cantidad) || 0;
      agrupado[pid].total_vendido += (Number(d.cantidad) || 0) * (Number(d.precio_unitario) || 0);
    }

    const productosIds = Object.keys(agrupado).filter(k => k !== 'null' && k !== 'undefined');
    if (productosIds.length === 0) return res.json([]);

    const { data: productos, error: prodError } = await supabase
      .from('productos')
      .select('id, nombre, imagen_url')
      .in('id', productosIds);

    if (prodError) throw prodError;

    const prodMap = {};
    (productos || []).forEach(p => { prodMap[p.id] = p; });

    const resultado = Object.values(agrupado)
      .map(item => ({
        ...item,
        total_vendido: Math.round(item.total_vendido * 100) / 100,
        nombre: prodMap[item.producto_id]?.nombre || `Producto #${item.producto_id}`,
        imagen_url: prodMap[item.producto_id]?.imagen_url || null,
      }))
      .sort((a, b) => b.cantidad_total - a.cantidad_total)
      .slice(0, Number(limite));

    res.json(resultado);
  } catch (error) {
    console.error('Error en obtenerProductosMasVendidos:', error);
    res.status(500).json({ error: 'Error al obtener productos más vendidos' });
  }
};

exports.obtenerMovimientosInventario = async (req, res) => {
  try {
    const { periodo, fecha_inicio, fecha_fin, tipo = 'todos' } = req.query;
    let start, end;
    if (periodo && periodo !== 'custom') {
      ({ start, end } = getPeriodoFilter(periodo));
    } else {
      start = fecha_inicio ? new Date(fecha_inicio).toISOString() : new Date(0).toISOString();
      end = fecha_fin ? new Date(fecha_fin + 'T23:59:59').toISOString() : new Date().toISOString();
    }

    let query = supabase
      .from('inventario_movimientos')
      .select('*, productos:producto_id(nombre), usuarios:usuario_id(nombre)')
      .gte('creado_en', start)
      .lte('creado_en', end)
      .order('creado_en', { ascending: false });

    if (tipo !== 'todos') {
      query = query.eq('tipo', tipo);
    }

    const { data: movimientos, error } = await query;

    if (error) throw error;

    const entradas = movimientos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.cantidad || 0), 0);
    const salidas = movimientos.filter(m => m.tipo === 'salida').reduce((s, m) => s + Number(m.cantidad || 0), 0);

    res.json({
      entradas,
      salidas,
      movimientos: (movimientos || []).map(m => ({
        fecha: m.creado_en,
        hora: m.creado_en ? new Date(m.creado_en).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' }) : '',
        producto: m.productos?.nombre || `Producto #${m.producto_id}`,
        tipo: m.tipo,
        cantidad: m.cantidad,
        descripcion: m.descripcion || '',
        usuario_nombre: m.usuarios?.nombre || '—',
      })),
    });
  } catch (error) {
    console.error('Error en obtenerMovimientosInventario:', error);
    res.status(500).json({ error: 'Error al obtener movimientos de inventario' });
  }
};

exports.obtenerResumenCaja = async (req, res) => {
  try {
    const { periodo, fecha_inicio, fecha_fin } = req.query;
    const { start, end } = getPeriodoFilter(periodo || 'hoy', fecha_inicio, fecha_fin);

    let pagos;
    let pagosError;
    const cajaCols = [
      'id, total, metodo, creado_en, pedido_id, usuario_id',
      'id, total, metodo, creado_en',
      'id, total, metodo',
    ];
    for (const cols of cajaCols) {
      const { data, error } = await supabase
        .from('pagos')
        .select(cols)
        .gte('creado_en', start)
        .lte('creado_en', end)
        .order('creado_en', { ascending: false });
      if (!error) { pagos = data; break; }
      pagosError = error;
    }
    if (!pagos) {
      console.error('Supabase error en pagos tras fallback:', pagosError);
      throw pagosError;
    }

    const total_ingresos = (pagos || []).reduce((s, p) => s + Number(p.total || 0), 0);
    const total_egresos = 0;

    const userIds = [...new Set((pagos || []).filter(p => p.usuario_id).map(p => p.usuario_id))];
    const userNameMap = {};
    if (userIds.length > 0) {
      const { data: userData } = await supabase
        .from('usuarios')
        .select('id, nombre')
        .in('id', userIds);
      (userData || []).forEach(u => { userNameMap[u.id] = u.nombre; });
    }

    res.json({
      total_ingresos,
      total_egresos,
      balance_neto: total_ingresos - total_egresos,
      movimientos: (pagos || []).map(p => ({
        fecha: p.creado_en,
        hora: p.creado_en ? new Date(p.creado_en).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' }) : '',
        tipo: 'ingreso',
        monto: p.total,
        descripcion: `Pago con ${p.metodo}`,
        usuario_nombre: userNameMap[p.usuario_id] || '—',
      })),
    });
  } catch (error) {
    console.error('Error en obtenerResumenCaja:', error);
    res.status(500).json({ error: 'Error al obtener resumen de caja' });
  }
};
