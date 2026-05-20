const supabase = require('../config/database');

const listar = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ingredientes')
      .select('*, proveedores(nombre)')
      .is('deleted_at', null)
      .order('nombre');
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('Error listando ingredientes:', e);
    res.status(500).json({ error: 'Error al listar ingredientes' });
  }
};

const crear = async (req, res) => {
  try {
    const { nombre, unidad, stock, stock_minimo, precio_compra, proveedor_id } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

    const { data, error } = await supabase.from('ingredientes').insert({
      nombre, unidad: unidad || 'unidad', stock: stock || 0,
      stock_minimo: stock_minimo || 0, precio_compra: precio_compra || 0,
      proveedor_id: proveedor_id || null,
    }).select().single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    console.error('Error creando ingrediente:', e);
    res.status(500).json({ error: 'Error al crear ingrediente' });
  }
};

const actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, actualizado_en: new Date().toISOString() };
    const { data, error } = await supabase.from('ingredientes')
      .update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error('Error actualizando ingrediente:', e);
    res.status(500).json({ error: 'Error al actualizar ingrediente' });
  }
};

const eliminar = async (req, res) => {
  try {
    const { id } = req.params;
    await supabase.from('ingredientes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    res.json({ message: 'Ingrediente eliminado' });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar ingrediente' });
  }
};

const ajustarStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, descripcion } = req.body;
    if (stock === undefined) return res.status(400).json({ error: 'Stock requerido' });

    const { data: actual } = await supabase.from('ingredientes').select('stock').eq('id', id).single();
    if (!actual) return res.status(404).json({ error: 'Ingrediente no encontrado' });

    const stockAnterior = Number(actual.stock);
    const stockNuevo = Number(stock);
    const diff = stockNuevo - stockAnterior;

    const { data, error } = await supabase.from('ingredientes')
      .update({ stock: stockNuevo, actualizado_en: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;

    await supabase.from('movimientos_ingredientes').insert({
      ingrediente_id: Number(id),
      tipo: diff > 0 ? 'entrada' : diff < 0 ? 'salida' : 'ajuste',
      cantidad: Math.abs(diff),
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo,
      descripcion: descripcion || 'Ajuste manual',
      usuario_id: req.user.id,
    });

    res.json(data);
  } catch (e) {
    console.error('Error ajustando stock:', e);
    res.status(500).json({ error: 'Error al ajustar stock' });
  }
};

const movimientos = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('movimientos_ingredientes')
      .select('*, usuarios(nombre)')
      .eq('ingrediente_id', id)
      .order('creado_en', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
};

module.exports = { listar, crear, actualizar, eliminar, ajustarStock, movimientos };
