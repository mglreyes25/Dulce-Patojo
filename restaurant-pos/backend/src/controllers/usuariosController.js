const supabase = require('../config/database');
const bcrypt = require('bcryptjs');

// OBTENER TODOS LOS USUARIOS
const obtenerUsuarios = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, correo, rol, activo, creado_en');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

// OBTENER USUARIO POR ID
const obtenerUsuarioPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, correo, rol, activo, creado_en')
      .eq('id', id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
};

// CREAR USUARIO
const crearUsuario = async (req, res) => {
  const { nombre, correo, password, rol } = req.body;

  if (!nombre || !correo || !password || !rol) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(correo)) {
    return res.status(400).json({ error: 'El formato del correo no es válido' });
  }

  const rolesValidos = ['Admin', 'Cajero', 'Cocinero', 'Despachador'];
  if (!rolesValidos.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('usuarios')
      .insert({ nombre, correo, password: hashedPassword, rol })
      .select('id, nombre, correo, rol, activo, creado_en')
      .single();

    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'El correo ya está registrado' });
      throw error;
    }

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'CREAR_USUARIO',
      descripcion: `Usuario ${nombre} creado con rol ${rol}`
    });

    res.status(201).json({ message: 'Usuario creado exitosamente', usuario: data });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

// ACTUALIZAR USUARIO
const actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, rol, password } = req.body;

  try {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (correo && !emailRegex.test(correo)) {
      return res.status(400).json({ error: 'El formato del correo no es válido' });
    }

    const updates = {};
    if (nombre) updates.nombre = nombre;
    if (correo) updates.correo = correo;
    if (rol) updates.rol = rol;
    if (password) updates.password = await bcrypt.hash(password, 10);
    updates.actualizado_en = new Date().toISOString();

    const { data, error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', id)
      .select('id, nombre, correo, rol, activo, actualizado_en')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Usuario no encontrado' });

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'ACTUALIZAR_USUARIO',
      descripcion: `Usuario ID ${id} actualizado`
    });

    res.json({ message: 'Usuario actualizado exitosamente', usuario: data });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

// INACTIVAR USUARIO
const inactivarUsuario = async (req, res) => {
  const { id } = req.params;
  const { descripcion } = req.body;
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .update({ activo: false, actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .select('id, nombre, correo, rol, activo')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Usuario no encontrado' });

    const motivo = descripcion || `Usuario ID ${id} inactivado`;
    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'INACTIVAR_USUARIO',
      descripcion: motivo
    });

    res.json({ message: 'Usuario inactivado exitosamente', usuario: data });
  } catch (error) {
    res.status(500).json({ error: 'Error al inactivar usuario' });
  }
};

// ACTIVAR USUARIO
const activarUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .update({ activo: true, actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .select('id, nombre, correo, rol, activo')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Usuario no encontrado' });

    await supabase.from('bitacora_permisos').insert({
      usuario_id: req.user.id,
      accion: 'ACTIVAR_USUARIO',
      descripcion: `Usuario ID ${id} activado`
    });

    res.json({ message: 'Usuario activado exitosamente', usuario: data });
  } catch (error) {
    res.status(500).json({ error: 'Error al activar usuario' });
  }
};

module.exports = { obtenerUsuarios, obtenerUsuarioPorId, crearUsuario, actualizarUsuario, inactivarUsuario, activarUsuario };