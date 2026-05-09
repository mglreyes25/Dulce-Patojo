const supabase = require('../config/database');

// ── CATEGORÍAS ────────────────────────────────────────────────────
const obtenerCategorias = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categorias').select('*').eq('activo', true).order('nombre');
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

const crearCategoria = async (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const { data, error } = await supabase
      .from('categorias').insert({ nombre, descripcion }).select().single();
    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'Categoría ya existe' });
      throw error;
    }
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al crear categoría' });
  }
};

// ── PRODUCTOS ────────────────────────────────────────────────────
const obtenerProductos = async (req, res) => {
  try {
    const { nombre, categoria_id, disponible } = req.query;
    let query = supabase.from('productos').select('*, categorias(nombre)').order('nombre');
    if (nombre)     query = query.ilike('nombre', `%${nombre}%`);
    if (categoria_id) query = query.eq('categoria_id', categoria_id);
    if (disponible !== undefined) query = query.eq('disponible', disponible === 'true');
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

const obtenerProductoPorId = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('productos').select('*, categorias(nombre)').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

const crearProducto = async (req, res) => {
  const { nombre, descripcion, precio, categoria_id, imagen_url } = req.body;
  if (!nombre || !precio || !categoria_id)
    return res.status(400).json({ error: 'Nombre, precio y categoría son obligatorios' });
  if (precio <= 0)
    return res.status(400).json({ error: 'El precio debe ser mayor a $0' });
  try {
    const { data, error } = await supabase
      .from('productos')
      .insert({ nombre, descripcion, precio, categoria_id, imagen_url: imagen_url || null })
      .select('*, categorias(nombre)').single();
    if (error) throw error;

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'CREAR_PRODUCTO',
      descripcion: `Producto "${nombre}" creado a $${precio}`
    });

    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

const actualizarProducto = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, precio, categoria_id, disponible, imagen_url } = req.body;
  try {
    // Registrar historial de precio si cambió
    if (precio !== undefined) {
      const { data: actual } = await supabase.from('productos').select('precio').eq('id', id).single();
      if (actual && Number(actual.precio) !== Number(precio)) {
        await supabase.from('historial_precios').insert({
          producto_id: id,
          precio_anterior: actual.precio,
          precio_nuevo: precio,
          usuario_id: req.user.id
        });
      }
    }

    const updates = {};
    if (nombre      !== undefined) updates.nombre      = nombre;
    if (descripcion !== undefined) updates.descripcion = descripcion;
    if (precio      !== undefined) updates.precio      = precio;
    if (categoria_id !== undefined) updates.categoria_id = categoria_id;
    if (disponible  !== undefined) updates.disponible  = disponible;
    // imagen_url puede llegar como null (quitar imagen) o como URL válida
    if ('imagen_url' in req.body) updates.imagen_url = imagen_url || null;
    updates.actualizado_en = new Date().toISOString();

    const { data, error } = await supabase
      .from('productos').update(updates).eq('id', id)
      .select('*, categorias(nombre)').single();
    if (error || !data) return res.status(404).json({ error: 'Producto no encontrado' });

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'ACTUALIZAR_PRODUCTO',
      descripcion: `Producto ID ${id} actualizado`
    });

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

const toggleDisponible = async (req, res) => {
  const { id } = req.params;
  try {
    const { data: actual } = await supabase
      .from('productos').select('disponible, nombre').eq('id', id).single();
    if (!actual) return res.status(404).json({ error: 'Producto no encontrado' });

    const { data, error } = await supabase
      .from('productos')
      .update({ disponible: !actual.disponible, actualizado_en: new Date().toISOString() })
      .eq('id', id).select('*, categorias(nombre)').single();
    if (error) throw error;

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: actual.disponible ? 'DESACTIVAR_PRODUCTO' : 'ACTIVAR_PRODUCTO',
      descripcion: `Producto "${actual.nombre}" ${actual.disponible ? 'desactivado' : 'activado'}`
    });

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al cambiar disponibilidad' });
  }
};

const obtenerHistorialPrecios = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('historial_precios')
      .select('*, productos(nombre), usuarios(nombre)')
      .eq('producto_id', req.params.id)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
};

// ── COMBOS ────────────────────────────────────────────────────────
const obtenerCombos = async (req, res) => {
  try {
    const { data: combos, error } = await supabase.from('combos').select('*').order('nombre');
    if (error) throw error;

    const combosConProductos = await Promise.all(combos.map(async (combo) => {
      const { data: items } = await supabase
        .from('combo_productos')
        .select('cantidad, productos(id, nombre, precio)')
        .eq('combo_id', combo.id);
      return { ...combo, items: items || [] };
    }));

    res.json(combosConProductos);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener combos' });
  }
};

const crearCombo = async (req, res) => {
  const { nombre, descripcion, precio, productos, imagen_url } = req.body;
  if (!nombre || !precio || !productos || productos.length < 2)
    return res.status(400).json({ error: 'Nombre, precio y al menos 2 productos son obligatorios' });

  try {
    let sumaProductos = 0;
    for (const p of productos) {
      const { data } = await supabase.from('productos').select('precio').eq('id', p.producto_id).single();
      if (data) sumaProductos += Number(data.precio) * (p.cantidad || 1);
    }
    if (Number(precio) >= sumaProductos)
      return res.status(400).json({
        error: `El precio del combo ($${precio}) debe ser menor a la suma de productos ($${sumaProductos.toFixed(2)})`
      });

    const { data: combo, error } = await supabase
      .from('combos')
      .insert({ nombre, descripcion, precio, imagen_url: imagen_url || null })
      .select().single();
    if (error) throw error;

    await supabase.from('combo_productos').insert(
      productos.map(p => ({ combo_id: combo.id, producto_id: p.producto_id, cantidad: p.cantidad || 1 }))
    );

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'CREAR_COMBO',
      descripcion: `Combo "${nombre}" creado a $${precio}`
    });

    res.status(201).json(combo);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear combo' });
  }
};

const actualizarCombo = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, precio, productos, imagen_url } = req.body;
  try {
    const updates = {};
    if (nombre)       updates.nombre      = nombre;
    if (descripcion !== undefined) updates.descripcion = descripcion;
    if (precio)       updates.precio      = precio;
    if ('imagen_url' in req.body) updates.imagen_url = imagen_url || null;
    updates.actualizado_en = new Date().toISOString();

    const { data, error } = await supabase
      .from('combos').update(updates).eq('id', id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Combo no encontrado' });

    if (productos && productos.length >= 2) {
      await supabase.from('combo_productos').delete().eq('combo_id', id);
      await supabase.from('combo_productos').insert(
        productos.map(p => ({ combo_id: id, producto_id: p.producto_id, cantidad: p.cantidad || 1 }))
      );
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar combo' });
  }
};

const toggleCombo = async (req, res) => {
  const { id } = req.params;
  try {
    const { data: actual } = await supabase.from('combos').select('activo').eq('id', id).single();
    if (!actual) return res.status(404).json({ error: 'Combo no encontrado' });
    const { data, error } = await supabase
      .from('combos').update({ activo: !actual.activo }).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al cambiar estado del combo' });
  }
};

module.exports = {
  obtenerCategorias, crearCategoria,
  obtenerProductos, obtenerProductoPorId, crearProducto, actualizarProducto,
  toggleDisponible, obtenerHistorialPrecios,
  obtenerCombos, crearCombo, actualizarCombo, toggleCombo
};