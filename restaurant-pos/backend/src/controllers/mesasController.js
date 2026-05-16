const supabase = require('../config/database');

const obtenerMesas = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('mesas')
      .select('*')
      .order('numero');
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('Error obteniendo mesas:', e);
    res.status(500).json({ error: 'Error al obtener mesas' });
  }
};

const crearMesa = async (req, res) => {
  const { numero, capacidad } = req.body;
  if (!numero) return res.status(400).json({ error: 'Número de mesa requerido' });

  try {
    const { data, error } = await supabase
      .from('mesas')
      .insert({ numero, capacidad: capacidad || 4 })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'El número de mesa ya existe' });
      throw error;
    }
    res.status(201).json(data);
  } catch (e) {
    console.error('Error creando mesa:', e);
    res.status(500).json({ error: 'Error al crear mesa' });
  }
};

const actualizarMesa = async (req, res) => {
  const { id } = req.params;
  const { numero, capacidad, estado } = req.body;
  try {
    const updates = {};
    if (numero !== undefined) updates.numero = numero;
    if (capacidad !== undefined) updates.capacidad = capacidad;
    if (estado !== undefined) updates.estado = estado;

    const { data, error } = await supabase
      .from('mesas')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Mesa no encontrada' });
    res.json(data);
  } catch (e) {
    console.error('Error actualizando mesa:', e);
    res.status(500).json({ error: 'Error al actualizar mesa' });
  }
};

const cambiarEstadoMesa = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  if (!['disponible', 'ocupada', 'pagando'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido. Use: disponible, ocupada, pagando' });
  }
  try {
    const { data, error } = await supabase
      .from('mesas')
      .update({ estado })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Mesa no encontrada' });
    res.json(data);
  } catch (e) {
    console.error('Error cambiando estado de mesa:', e);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
};

module.exports = { obtenerMesas, crearMesa, actualizarMesa, cambiarEstadoMesa };
