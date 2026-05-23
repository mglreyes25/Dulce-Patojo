const supabase = require('../config/database');
const { emitCobroIniciado, emitBloqueoLiberado } = require('../config/socketEmitter');

const obtenerCobrosPendientes = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, mesa } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

    let query = supabase
      .from('vw_cobros_pendientes')
      .select('*', { count: 'exact' })
      .order('bloqueo_usuario_id', { ascending: false, nullsFirst: false })
      .order('creado_en', { ascending: true })
      .range(offset, offset + Number(limit) - 1);

    if (search) {
      const term = `%${search}%`;
      query = query.or(`numero_ticket::text.ilike.${term},cliente_nombre.ilike.${term}`);
    }
    if (mesa) {
      query = query.eq('mesa_id', Number(mesa));
    }

    const { data, error, count } = await query;
    if (error) {
      console.error('Error query vw_cobros_pendientes:', error);
      const { data: fallback } = await supabase
        .from('pedidos')
        .select('*, mesa:mesas(numero), pedido_items(*)')
        .in('estado', ['listo', 'entregado'])
        .order('creado_en', { ascending: false });

      // Normalizar a la misma estructura que vw_cobros_pendientes
      const normalizados = (fallback || []).map(p => ({
        ...p,
        mesa_numero: p.mesa?.numero || null,
        items_resumen: (p.pedido_items || []).map(pi => ({
          id: pi.id,
          nombre: pi.nombre,
          cantidad: pi.cantidad,
          precio_unitario: pi.precio_unitario,
          tipo_item: pi.tipo_item,
          notas: pi.notas,
        })),
      }));

      return res.json({ data: normalizados, total: normalizados.length, page: 1, limit: Number(limit) });
    }

    res.json({
      data: data || [],
      total: count || 0,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil((count || 0) / Number(limit)),
    });
  } catch (e) {
    console.error('Error al obtener cobros pendientes:', e);
    res.status(500).json({ error: 'Error al obtener cobros pendientes', detalle: e.message });
  }
};

const iniciarCobro = async (req, res) => {
  const { pedido_id } = req.body;
  const usuario_id = req.user?.id || 1;

  if (!pedido_id) {
    return res.status(400).json({ error: 'pedido_id es requerido' });
  }

  try {
    const { data, error } = await supabase
      .rpc('fn_iniciar_cobro', {
        p_pedido_id: Number(pedido_id),
        p_usuario_id: Number(usuario_id),
      });

    if (error) {
      console.error('Error al llamar fn_iniciar_cobro:', error);
      return res.status(500).json({ error: 'Error al iniciar cobro', detalle: error.message });
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data;

    if (!result.success) {
      return res.status(result.code || 409).json({
        error: result.error,
        bloqueado_por: result.bloqueado_por,
        bloqueado_por_nombre: result.bloqueado_por_nombre,
        bloqueo_iniciado_en: result.bloqueo_iniciado_en,
      });
    }

    emitCobroIniciado({
      pedido_id: result.pedido_id,
      usuario_id: result.usuario_id,
      usuario_nombre: result.usuario_nombre,
      iniciado_en: result.iniciado_en,
    });

    res.json({
      message: 'Cobro iniciado exitosamente',
      pedido_id: result.pedido_id,
      usuario_id: result.usuario_id,
      usuario_nombre: result.usuario_nombre,
      iniciado_en: result.iniciado_en,
    });
  } catch (e) {
    console.error('Error en iniciarCobro:', e);
    res.status(500).json({ error: 'Error al iniciar cobro', detalle: e.message });
  }
};

const liberarBloqueo = async (req, res) => {
  const { pedido_id } = req.body;
  const usuario_id = req.user?.id || 1;
  const es_admin = req.user?.rol === 'Admin';

  if (!pedido_id) {
    return res.status(400).json({ error: 'pedido_id es requerido' });
  }

  try {
    const { data, error } = await supabase
      .rpc('fn_liberar_bloqueo', {
        p_pedido_id: Number(pedido_id),
        p_usuario_id: Number(usuario_id),
        p_es_admin: es_admin,
      });

    if (error) {
      return res.status(500).json({ error: 'Error al liberar bloqueo', detalle: error.message });
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data;

    if (!result.success) {
      return res.status(result.code || 403).json({ error: result.error });
    }

    emitBloqueoLiberado({ pedido_id: result.pedido_id });

    res.json({ message: 'Bloqueo liberado exitosamente', pedido_id: result.pedido_id });
  } catch (e) {
    console.error('Error en liberarBloqueo:', e);
    res.status(500).json({ error: 'Error al liberar bloqueo', detalle: e.message });
  }
};

const obtenerLogEstados = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('pedidos_estado_log')
      .select('*, usuarios(nombre)')
      .eq('pedido_id', id)
      .order('creado_en', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Error al obtener log de estados', detalle: error.message });
    }

    res.json(data || []);
  } catch (e) {
    console.error('Error al obtener log de estados:', e);
    res.status(500).json({ error: 'Error al obtener log de estados', detalle: e.message });
  }
};

module.exports = {
  obtenerCobrosPendientes,
  iniciarCobro,
  liberarBloqueo,
  obtenerLogEstados,
};
