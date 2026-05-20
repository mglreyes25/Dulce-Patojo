const supabase = require('../config/database');

const listar = async (req, res) => {
  try {
    const { producto_id } = req.query;
    let query = supabase
      .from('recetas')
      .select('*, ingredientes(nombre, unidad), productos(nombre)')
      .order('producto_id');

    if (producto_id) query = query.eq('producto_id', producto_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('Error listando recetas:', e);
    res.status(500).json({ error: 'Error al listar recetas' });
  }
};

const guardar = async (req, res) => {
  try {
    const { producto_id, items } = req.body;
    if (!producto_id || !items?.length)
      return res.status(400).json({ error: 'Producto y al menos un ingrediente requerido' });

    // Reemplazar todas las recetas del producto
    await supabase.from('recetas').delete().eq('producto_id', producto_id);

    const inserts = items.map(item => ({
      producto_id,
      ingrediente_id: item.ingrediente_id,
      cantidad: Number(item.cantidad) || 1,
    }));

    const { data, error } = await supabase.from('recetas').insert(inserts).select();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    console.error('Error guardando recetas:', e);
    res.status(500).json({ error: 'Error al guardar recetas' });
  }
};

module.exports = { listar, guardar };
