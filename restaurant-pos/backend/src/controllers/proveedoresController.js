const supabase = require('../config/database');

const listar = async (req, res) => {
  try {
    const { data, error } = await supabase.from('proveedores')
      .select('*').is('deleted_at', null).order('nombre');
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: 'Error al listar proveedores' });
  }
};

const crear = async (req, res) => {
  try {
    const { nombre, contacto, telefono, correo, direccion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const { data, error } = await supabase.from('proveedores')
      .insert({ nombre, contacto, telefono, correo, direccion }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
};

const actualizar = async (req, res) => {
  try {
    const { data, error } = await supabase.from('proveedores')
      .update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
};

const eliminar = async (req, res) => {
  try {
    await supabase.from('proveedores').update({ deleted_at: new Date().toISOString() }).eq('id', req.params.id);
    res.json({ message: 'Proveedor eliminado' });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar proveedor' });
  }
};

module.exports = { listar, crear, actualizar, eliminar };
