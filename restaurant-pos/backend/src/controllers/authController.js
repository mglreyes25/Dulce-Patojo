const supabase = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ── LOGIN ─────────────────────────────────────────────────────────
const login = async (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password)
    return res.status(400).json({ error: 'Correo y contraseña requeridos' });

  try {
    const { data: intento } = await supabase
      .from('intentos_login').select('*').eq('correo', correo).maybeSingle();

    if (intento?.bloqueado_hasta && new Date(intento.bloqueado_hasta) > new Date()) {
      const mins = Math.ceil((new Date(intento.bloqueado_hasta) - new Date()) / 60000);
      return res.status(403).json({ error: `Cuenta bloqueada. Intenta en ${mins} minuto(s).` });
    }

    const { data: usuario } = await supabase
      .from('usuarios').select('*').eq('correo', correo).maybeSingle();

    if (!usuario) {
      await registrarIntento(correo, intento);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    if (!usuario.activo)
      return res.status(403).json({ error: 'Usuario inactivo. Contacta al administrador.' });

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      const intentosActuales = await registrarIntento(correo, intento);
      const restantes = 3 - intentosActuales;
      if (restantes <= 0)
        return res.status(403).json({ error: 'Cuenta bloqueada por 5 minutos tras 3 intentos fallidos.' });
      return res.status(401).json({ error: `Contraseña incorrecta. Te quedan ${restantes} intento(s).` });
    }

    await supabase.from('intentos_login').delete().eq('correo', correo);

    const token = jwt.sign(
      { id: usuario.id, correo: usuario.correo, rol: usuario.rol, nombre: usuario.nombre },
      process.env.JWT_SECRET || 'clave_secreta_temporal',
      { expiresIn: '30m' }
    );

    await supabase.from('bitacora_permisos').insert({
      usuario_id: usuario.id, accion: 'LOGIN',
      descripcion: `Inicio de sesión con rol ${usuario.rol}`
    });

    res.json({
      message: 'Login exitoso', token,
      usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol }
    });
  } catch (e) {
    console.error('❌ Error en login:', e);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const registrarIntento = async (correo, intentoActual) => {
  const intentos = (intentoActual?.intentos || 0) + 1;
  const bloqueado_hasta = intentos >= 3 ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;
  if (intentoActual) {
    await supabase.from('intentos_login')
      .update({ intentos, bloqueado_hasta, actualizado_en: new Date().toISOString() })
      .eq('correo', correo);
  } else {
    await supabase.from('intentos_login').insert({ correo, intentos, bloqueado_hasta });
  }
  return intentos;
};

// ── REGISTRO PÚBLICO (queda inactivo hasta que admin lo apruebe) ──
const registroPublico = async (req, res) => {
  const { nombre, correo, password, rol } = req.body;
  if (!nombre || !correo || !password)
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });

  const rolesPermitidos = ['Cajero', 'Cocinero', 'Despachador'];
  const rolFinal = rolesPermitidos.includes(rol) ? rol : 'Cajero';

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('usuarios')
      .insert({ nombre, correo, password: hashedPassword, rol: rolFinal, activo: false })
      .select('id, nombre, correo, rol')
      .single();

    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'El correo ya está registrado' });
      throw error;
    }
    res.status(201).json({ message: 'Cuenta creada. Espera aprobación del administrador.', usuario: data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al registrar' });
  }
};

// ── LOGOUT ────────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    if (req.user) {
      await supabase.from('bitacora_permisos').insert({
        usuario_id: req.user.id, accion: 'LOGOUT', descripcion: 'Cierre de sesión'
      });
    }
  } catch (_) {}
  res.json({ message: 'Sesión cerrada exitosamente' });
};

const verificarToken = (req, res) => {
  res.json({ valid: true, usuario: req.user });
};

module.exports = { login, logout, verificarToken, registroPublico };