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
      .insert({ nombre, descripcion, precio, categoria_id, imagen_url: imagen_url || null, stock: 0, stock_minimo: 0 })
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
    if (nombre       !== undefined) updates.nombre       = nombre;
    if (descripcion  !== undefined) updates.descripcion  = descripcion;
    if (precio       !== undefined) updates.precio       = precio;
    if (categoria_id !== undefined) updates.categoria_id = categoria_id;
    if (disponible   !== undefined) updates.disponible   = disponible;
    if ('imagen_url' in req.body)   updates.imagen_url   = imagen_url || null;
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

// ── ACTUALIZACIÓN MASIVA DE PRECIOS POR CATEGORÍA ────────────────
const actualizarPreciosMasivo = async (req, res) => {
  const { categoria_id, porcentaje, precio_fijo } = req.body;

  if (!categoria_id)
    return res.status(400).json({ error: 'Categoría requerida' });
  if (porcentaje === undefined && precio_fijo === undefined)
    return res.status(400).json({ error: 'Debes indicar porcentaje o precio fijo' });
  if (precio_fijo !== undefined && Number(precio_fijo) <= 0)
    return res.status(400).json({ error: 'El precio debe ser mayor a $0' });

  try {
    // Obtener todos los productos de la categoría
    const { data: productos, error: prodError } = await supabase
      .from('productos')
      .select('id, nombre, precio')
      .eq('categoria_id', categoria_id);

    if (prodError) throw prodError;
    if (!productos || productos.length === 0)
      return res.status(404).json({ error: 'No hay productos en esa categoría' });

    const historial = [];
    const ahora = new Date().toISOString();

    for (const prod of productos) {
      let nuevoPrecio;
      if (precio_fijo !== undefined) {
        nuevoPrecio = Number(precio_fijo);
      } else {
        // porcentaje puede ser positivo (aumento) o negativo (descuento)
        nuevoPrecio = Number((prod.precio * (1 + Number(porcentaje) / 100)).toFixed(2));
      }

      if (nuevoPrecio <= 0) continue; // saltar si queda en 0 o negativo

      // Actualizar precio
      await supabase.from('productos')
        .update({ precio: nuevoPrecio, actualizado_en: ahora })
        .eq('id', prod.id);

      // Registrar en historial
      historial.push({
        producto_id: prod.id,
        precio_anterior: prod.precio,
        precio_nuevo: nuevoPrecio,
        usuario_id: req.user.id
      });
    }

    if (historial.length > 0) {
      await supabase.from('historial_precios').insert(historial);
    }

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'ACTUALIZAR_PRECIOS_MASIVO',
      descripcion: `Actualización masiva de ${historial.length} producto(s) en categoría ID ${categoria_id}`
    });

    res.json({
      message: `${historial.length} producto(s) actualizados exitosamente`,
      actualizados: historial.length
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar precios' });
  }
};

// ── REVERTIR ÚLTIMO CAMBIO DE PRECIO DE UN PRODUCTO ──────────────
const revertirUltimoPrecio = async (req, res) => {
  const { id } = req.params;
  try {
    // Obtener el último cambio en el historial
    const { data: ultimo, error: histError } = await supabase
      .from('historial_precios')
      .select('*')
      .eq('producto_id', id)
      .order('creado_en', { ascending: false })
      .limit(1)
      .single();

    if (histError || !ultimo)
      return res.status(404).json({ error: 'No hay cambios de precio para revertir' });

    // Restaurar el precio anterior
    const { data: producto, error: updateError } = await supabase
      .from('productos')
      .update({ precio: ultimo.precio_anterior, actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .select('*, categorias(nombre)')
      .single();

    if (updateError) throw updateError;

    // Registrar la reversión en el historial
    await supabase.from('historial_precios').insert({
      producto_id: id,
      precio_anterior: ultimo.precio_nuevo,
      precio_nuevo: ultimo.precio_anterior,
      usuario_id: req.user.id
    });

    // Eliminar el registro revertido
    await supabase.from('historial_precios').delete().eq('id', ultimo.id);

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'REVERTIR_PRECIO',
      descripcion: `Precio de producto ID ${id} revertido de $${ultimo.precio_nuevo} a $${ultimo.precio_anterior}`
    });

    res.json({
      message: `Precio revertido de $${ultimo.precio_nuevo} a $${ultimo.precio_anterior}`,
      producto
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al revertir precio' });
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
        .select('cantidad, productos(id, nombre, precio, stock, stock_minimo)')
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

// ELIMINAR PRODUCTO (permanente)
const eliminarProducto = async (req, res) => {
  const { id } = req.params;
  try {
    const { data: producto, error: getError } = await supabase
      .from('productos')
      .select('id, nombre')
      .eq('id', id)
      .single();

    if (getError || !producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '23503') {
        return res.status(409).json({ error: 'No se puede eliminar el producto porque tiene registros asociados (pedidos, combos, recetas). Puede ocultarlo (No disponible) en su lugar.' });
      }
      throw error;
    }

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'ELIMINAR_PRODUCTO',
      descripcion: `Producto "${producto.nombre}" eliminado permanentemente`
    });

    res.json({ message: 'Producto eliminado permanentemente', producto });
  } catch (e) {
    console.error('Error eliminando producto:', e);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};

module.exports = {
  obtenerCategorias, crearCategoria,
  obtenerProductos, obtenerProductoPorId, crearProducto, actualizarProducto,
  toggleDisponible, obtenerHistorialPrecios,
  actualizarPreciosMasivo, revertirUltimoPrecio,
  obtenerCombos, crearCombo, actualizarCombo, toggleCombo,
  eliminarProducto
};