const supabase = require('../config/database');

const obtenerPromociones = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('promociones')
      .select('id, nombre, descripcion, tipo, valor, producto_id, categoria_id, hora_inicio, hora_fin, automatica, activo, cantidad_maxima, creado_en, actualizado_en, creado_por, productos(nombre, precio), categorias(nombre)')
      .order('creado_en', { ascending: false });
    if (error) throw error;
    // Asegurar que cantidad_maxima siempre esté presente
    res.json((data || []).map(p => ({ ...p, cantidad_maxima: p.cantidad_maxima || null })));
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener promociones' });
  }
};

const obtenerPromocionesActivas = async (req, res) => {
  try {
    const ahora = new Date();
    const horaActual = ahora.toTimeString().slice(0, 5); // HH:MM

    const { data, error } = await supabase
      .from('promociones')
      .select('id, nombre, descripcion, tipo, valor, producto_id, categoria_id, hora_inicio, hora_fin, automatica, activo, cantidad_maxima, creado_en, actualizado_en, creado_por, productos(id, nombre, precio), categorias(id, nombre)')
      .eq('activo', true)
      .order('creado_en', { ascending: false });

    if (error) throw error;

    // Asegurar que cantidad_maxima siempre esté presente
    const conCantidad = (data || []).map(p => ({ ...p, cantidad_maxima: p.cantidad_maxima || null }));

    // Filtrar happy hour por hora actual
    const filtradas = conCantidad.filter(p => {
      if (p.tipo === 'happy_hour') {
        if (!p.hora_inicio || !p.hora_fin) return true;
        return horaActual >= p.hora_inicio && horaActual <= p.hora_fin;
      }
      return true;
    });

    res.json(filtradas);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener promociones activas' });
  }
};

const crearPromocion = async (req, res) => {
  const {
    nombre, descripcion, tipo, valor,
    producto_id, categoria_id,
    hora_inicio, hora_fin, automatica,
    cantidad_maxima
  } = req.body;

  if (!nombre || !tipo)
    return res.status(400).json({ error: 'Nombre y tipo son obligatorios' });

  if (tipo === 'descuento_porcentaje') {
    if (!valor || valor <= 0 || valor > 100)
      return res.status(400).json({ error: 'El descuento debe ser entre 1% y 100%' });
    if (!producto_id && !categoria_id)
      return res.status(400).json({ error: 'Debes seleccionar un producto o categoría' });
  }

  if (tipo === 'happy_hour') {
    if (!valor || valor <= 0 || valor > 100)
      return res.status(400).json({ error: 'El descuento happy hour debe ser entre 1% y 100%' });
    if (!hora_inicio || !hora_fin)
      return res.status(400).json({ error: 'Debes indicar hora de inicio y fin' });
    if (hora_inicio >= hora_fin)
      return res.status(400).json({ error: 'La hora de inicio debe ser menor a la hora de fin' });
  }

  if (tipo === 'dos_x_uno' || tipo === 'tres_x_dos') {
    if (!producto_id && !categoria_id)
      return res.status(400).json({ error: 'Debes seleccionar un producto o categoría para esta promoción' });
  }

  try {
    const { data, error } = await supabase
      .from('promociones')
      .insert({
        nombre, descripcion, tipo, valor: valor || null,
        producto_id: producto_id || null,
        categoria_id: categoria_id || null,
        hora_inicio: hora_inicio || null,
        hora_fin: hora_fin || null,
        automatica: automatica !== false,
        cantidad_maxima: cantidad_maxima ? Number(cantidad_maxima) : null,
        creado_por: req.user.id
      })
      .select('*, productos(nombre, precio), categorias(nombre)')
      .single();

    if (error) throw error;

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'CREAR_PROMOCION',
      descripcion: `Promoción "${nombre}" de tipo ${tipo} creada`
    });

    res.status(201).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear promoción' });
  }
};

const actualizarPromocion = async (req, res) => {
  const { id } = req.params;
  const {
    nombre, descripcion, tipo, valor,
    producto_id, categoria_id,
    hora_inicio, hora_fin, automatica,
    cantidad_maxima
  } = req.body;

  try {
    const updates = {};
    if (nombre        !== undefined) updates.nombre        = nombre;
    if (descripcion   !== undefined) updates.descripcion   = descripcion;
    if (tipo          !== undefined) updates.tipo          = tipo;
    if (valor         !== undefined) updates.valor         = valor;
    if (producto_id   !== undefined) updates.producto_id   = producto_id || null;
    if (categoria_id  !== undefined) updates.categoria_id  = categoria_id || null;
    if (hora_inicio   !== undefined) updates.hora_inicio   = hora_inicio || null;
    if (hora_fin      !== undefined) updates.hora_fin      = hora_fin    || null;
    if (automatica    !== undefined) updates.automatica    = automatica;
    if (cantidad_maxima !== undefined) updates.cantidad_maxima = cantidad_maxima ? Number(cantidad_maxima) : null;
    updates.actualizado_en = new Date().toISOString();

    const { data, error } = await supabase
      .from('promociones')
      .update(updates)
      .eq('id', id)
      .select('*, productos(nombre, precio), categorias(nombre)')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Promoción no encontrada' });

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'ACTUALIZAR_PROMOCION',
      descripcion: `Promoción ID ${id} actualizada`
    });

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar promoción' });
  }
};

const togglePromocion = async (req, res) => {
  const { id } = req.params;
  try {
    const { data: actual } = await supabase
      .from('promociones').select('activo, nombre').eq('id', id).single();
    if (!actual) return res.status(404).json({ error: 'Promoción no encontrada' });

    const { data, error } = await supabase
      .from('promociones')
      .update({ activo: !actual.activo, actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .select('*, productos(nombre, precio), categorias(nombre)')
      .single();

    if (error) throw error;

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: actual.activo ? 'DESACTIVAR_PROMOCION' : 'ACTIVAR_PROMOCION',
      descripcion: `Promoción "${actual.nombre}" ${actual.activo ? 'desactivada' : 'activada'}`
    });

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
};

const eliminarPromocion = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('promociones').delete().eq('id', id);
    if (error) throw error;

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'ELIMINAR_PROMOCION',
      descripcion: `Promoción ID ${id} eliminada`
    });

    res.json({ message: 'Promoción eliminada' });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar promoción' });
  }
};

module.exports = {
  obtenerPromociones,
  obtenerPromocionesActivas,
  crearPromocion,
  actualizarPromocion,
  togglePromocion,
  eliminarPromocion
};
