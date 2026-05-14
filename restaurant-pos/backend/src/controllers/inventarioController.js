const supabase = require('../config/database');

// OBTENER INVENTARIO (todos los productos con stock)
const obtenerInventario = async (req, res) => {
  try {
    const { bajo_stock } = req.query;
    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, descripcion, precio, stock, stock_minimo, disponible, imagen_url, categoria_id, categorias(nombre)')
      .order('nombre');
    if (error) throw error;

    const inventario = (data || []).map(p => ({
      ...p,
      bajo_stock: p.stock_minimo > 0 && p.stock <= p.stock_minimo,
      sin_stock: p.stock <= 0,
    }));

    if (bajo_stock === 'true') {
      return res.json(inventario.filter(p => p.bajo_stock || p.sin_stock));
    }

    res.json(inventario);
  } catch (e) {
    console.error('Error obteniendo inventario:', e);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
};

// OBTENER MOVIMIENTOS DE UN PRODUCTO
const obtenerMovimientos = async (req, res) => {
  const { producto_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('inventario_movimientos')
      .select('*, usuarios(nombre)')
      .eq('producto_id', producto_id)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('Error obteniendo movimientos:', e);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
};

// REGISTRAR ENTRADA DE STOCK
const registrarEntrada = async (req, res) => {
  const { producto_id, cantidad, descripcion } = req.body;

  if (!producto_id || !cantidad || cantidad <= 0) {
    return res.status(400).json({ error: 'Producto y cantidad positiva son obligatorios' });
  }

  try {
    const { data: producto, error: prodError } = await supabase
      .from('productos')
      .select('id, nombre, stock')
      .eq('id', producto_id)
      .single();

    if (prodError || !producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const stockAnterior = producto.stock || 0;
    const stockNuevo = stockAnterior + Number(cantidad);

    await supabase
      .from('productos')
      .update({ stock: stockNuevo, actualizado_en: new Date().toISOString() })
      .eq('id', producto_id);

    const { data: mov, error: movError } = await supabase
      .from('inventario_movimientos')
      .insert({
        producto_id,
        tipo: 'entrada',
        cantidad: Number(cantidad),
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        descripcion: descripcion || `Entrada de ${cantidad} unidad(es)`,
        usuario_id: req.user.id,
      })
      .select()
      .single();

    if (movError) throw movError;

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'ENTRADA_INVENTARIO',
      descripcion: `Entrada de ${cantidad} x "${producto.nombre}" — Stock: ${stockAnterior} → ${stockNuevo}`
    });

    res.status(201).json(mov);
  } catch (e) {
    console.error('Error registrando entrada:', e);
    res.status(500).json({ error: 'Error al registrar entrada' });
  }
};

// REGISTRAR SALIDA DE STOCK
const registrarSalida = async (req, res) => {
  const { producto_id, cantidad, descripcion } = req.body;

  if (!producto_id || !cantidad || cantidad <= 0) {
    return res.status(400).json({ error: 'Producto y cantidad positiva son obligatorios' });
  }

  try {
    const { data: producto, error: prodError } = await supabase
      .from('productos')
      .select('id, nombre, stock')
      .eq('id', producto_id)
      .single();

    if (prodError || !producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const stockAnterior = producto.stock || 0;
    if (stockAnterior < Number(cantidad)) {
      return res.status(400).json({
        error: `Stock insuficiente. Disponible: ${stockAnterior}, solicitado: ${cantidad}`
      });
    }

    const stockNuevo = stockAnterior - Number(cantidad);

    await supabase
      .from('productos')
      .update({ stock: stockNuevo, actualizado_en: new Date().toISOString() })
      .eq('id', producto_id);

    const { data: mov, error: movError } = await supabase
      .from('inventario_movimientos')
      .insert({
        producto_id,
        tipo: 'salida',
        cantidad: Number(cantidad),
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        descripcion: descripcion || `Salida de ${cantidad} unidad(es)`,
        usuario_id: req.user.id,
      })
      .select()
      .single();

    if (movError) throw movError;

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'SALIDA_INVENTARIO',
      descripcion: `Salida de ${cantidad} x "${producto.nombre}" — Stock: ${stockAnterior} → ${stockNuevo}`
    });

    res.status(201).json(mov);
  } catch (e) {
    console.error('Error registrando salida:', e);
    res.status(500).json({ error: 'Error al registrar salida' });
  }
};

// AJUSTAR STOCK
const ajustarStock = async (req, res) => {
  const { producto_id, stock_nuevo, descripcion } = req.body;

  if (!producto_id || stock_nuevo === undefined || stock_nuevo < 0) {
    return res.status(400).json({ error: 'Producto y stock nuevo (≥ 0) son obligatorios' });
  }

  try {
    const { data: producto, error: prodError } = await supabase
      .from('productos')
      .select('id, nombre, stock')
      .eq('id', producto_id)
      .single();

    if (prodError || !producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const stockAnterior = producto.stock || 0;

    await supabase
      .from('productos')
      .update({ stock: Number(stock_nuevo), actualizado_en: new Date().toISOString() })
      .eq('id', producto_id);

    const { data: mov, error: movError } = await supabase
      .from('inventario_movimientos')
      .insert({
        producto_id,
        tipo: 'ajuste',
        cantidad: Number(stock_nuevo) - stockAnterior,
        stock_anterior: stockAnterior,
        stock_nuevo: Number(stock_nuevo),
        descripcion: descripcion || `Ajuste de stock: ${stockAnterior} → ${stock_nuevo}`,
        usuario_id: req.user.id,
      })
      .select()
      .single();

    if (movError) throw movError;

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'AJUSTE_INVENTARIO',
      descripcion: `Ajuste de "${producto.nombre}": ${stockAnterior} → ${stock_nuevo}`
    });

    res.status(201).json(mov);
  } catch (e) {
    console.error('Error ajustando stock:', e);
    res.status(500).json({ error: 'Error al ajustar stock' });
  }
};

// ACTUALIZAR STOCK MÍNIMO
const actualizarStockMinimo = async (req, res) => {
  const { producto_id, stock_minimo } = req.body;

  if (!producto_id || stock_minimo === undefined || stock_minimo < 0) {
    return res.status(400).json({ error: 'Producto y stock mínimo (≥ 0) son obligatorios' });
  }

  try {
    const { data, error } = await supabase
      .from('productos')
      .update({ stock_minimo: Number(stock_minimo), actualizado_en: new Date().toISOString() })
      .eq('id', producto_id)
      .select('id, nombre, stock, stock_minimo')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Producto no encontrado' });

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar stock mínimo' });
  }
};

module.exports = {
  obtenerInventario,
  obtenerMovimientos,
  registrarEntrada,
  registrarSalida,
  ajustarStock,
  actualizarStockMinimo,
};
