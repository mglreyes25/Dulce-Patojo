const supabase = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { hasActiveSession, addSession, removeSession } = require('../config/sessionManager');

/* ──────────────────────────────────────────────────────────────────
   HELPER: parsear timestamps de Supabase como UTC.
   
   Bug original: Supabase a veces devuelve timestamps sin indicador
   de zona horaria (ej. "2025-05-08 12:05:00"). JavaScript lo
   interpreta como hora LOCAL (UTC-6 en El Salvador), sumándole
   6 horas al tiempo de bloqueo → resultado: ~364 minutos en vez de 5.

   Fix: Si el string no tiene '+' ni termina en 'Z', se añade 'Z'
   para forzar interpretación UTC.
   ────────────────────────────────────────────────────────────────── */
const parseUTC = (ts) => {
  if (!ts) return null;
  const str = String(ts);
  if (str.includes('+') || str.endsWith('Z')) return new Date(str);
  // Normalizar separador de fecha-hora y añadir Z
  return new Date(str.replace(' ', 'T') + 'Z');
};

/* ──────────────────────────────────────────────────────────────────
   Validación estricta de contraseña (backend).
   Debe coincidir con las reglas del frontend (password.js).
   ────────────────────────────────────────────────────────────────── */
const validarPasswordEstricta = (pwd) => {
  if (!pwd || pwd.length < 8)
    return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(pwd))
    return 'Debe contener al menos una letra mayúscula';
  if (!/[a-z]/.test(pwd))
    return 'Debe contener al menos una letra minúscula';
  if (!/[0-9]/.test(pwd))
    return 'Debe contener al menos un número';
  if (!/[!@#$%^&*()\-_=+{}\[\]|;:',.<>?/`~\\"]/.test(pwd))
    return 'Debe contener al menos un carácter especial (!@#$%...)';
  return null;
};

// ── LOGIN ─────────────────────────────────────────────────────────
const login = async (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password)
    return res.status(400).json({ error: 'Correo y contraseña requeridos' });

  try {
    const { data: intento } = await supabase
      .from('intentos_login').select('*').eq('correo', correo).maybeSingle();

    // ── Verificar bloqueo usando parseUTC para evitar el bug de zona horaria ──
    if (intento?.bloqueado_hasta) {
      const bloqueadoHasta = parseUTC(intento.bloqueado_hasta);
      if (bloqueadoHasta > new Date()) {
        const mins = Math.ceil((bloqueadoHasta - new Date()) / 60000);
        return res.status(403).json({
          error: `Cuenta bloqueada. Intenta en ${mins} minuto(s).`,
        });
      }
    }

    const { data: usuario } = await supabase
      .from('usuarios').select('*').eq('correo', correo).maybeSingle();

    if (!usuario) {
      await registrarIntento(correo, intento);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    if (!usuario.activo)
      return res.status(403).json({
        error: 'Usuario inactivo. Contacta al administrador.',
      });

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      const intentosActuales = await registrarIntento(correo, intento);
      const restantes = 3 - intentosActuales;
      if (restantes <= 0)
        return res.status(403).json({
          error: 'Cuenta bloqueada por 5 minutos tras 3 intentos fallidos.',
        });
      return res.status(401).json({
        error: `Contraseña incorrecta. Te quedan ${restantes} intento(s).`,
      });
    }

    // Verificar sesión única
    if (hasActiveSession(usuario.id)) {
      return res.status(403).json({
        error: 'Ya hay una sesión activa para este usuario. Cierra sesión en el otro dispositivo primero.',
      });
    }

    // Login exitoso → limpiar intentos
    await supabase.from('intentos_login').delete().eq('correo', correo);

    const token = jwt.sign(
      { id: usuario.id, correo: usuario.correo, rol: usuario.rol, nombre: usuario.nombre },
      process.env.JWT_SECRET || 'clave_secreta_temporal',
      { expiresIn: '30m' }
    );

    addSession(usuario.id);

    await supabase.from('bitacora_permisos').insert({
      usuario_id: usuario.id, accion: 'LOGIN',
      descripcion: `Inicio de sesión con rol ${usuario.rol}`,
    });

    res.json({
      message: 'Login exitoso', token,
      usuario: {
        id: usuario.id, nombre: usuario.nombre,
        correo: usuario.correo, rol: usuario.rol,
      },
    });
  } catch (e) {
    console.error('❌ Error en login:', e);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

/* Registra un intento fallido. Retorna el total de intentos acumulados. */
const registrarIntento = async (correo, intentoActual) => {
  const intentos = (intentoActual?.intentos || 0) + 1;
  // Almacenar bloqueado_hasta en UTC explícito con sufijo Z
  const bloqueado_hasta = intentos >= 3
    ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
    : null;

  if (intentoActual) {
    await supabase.from('intentos_login')
      .update({ intentos, bloqueado_hasta, actualizado_en: new Date().toISOString() })
      .eq('correo', correo);
  } else {
    await supabase.from('intentos_login')
      .insert({ correo, intentos, bloqueado_hasta });
  }
  return intentos;
};

// ── REGISTRO PÚBLICO (queda inactivo hasta que admin lo apruebe) ──
const registroPublico = async (req, res) => {
  const { nombre, correo, password, rol } = req.body;
  if (!nombre || !correo || !password)
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });

  // Validación estricta de contraseña
  const errPwd = validarPasswordEstricta(password);
  if (errPwd) return res.status(400).json({ error: errPwd });

  const rolesPermitidos = ['Cajero', 'Cocinero', 'Despachador'];
  const rolFinal = rolesPermitidos.includes(rol) ? rol : 'Cajero';

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('usuarios')
      .insert({
        nombre, correo, password: hashedPassword, rol: rolFinal, activo: false,
      })
      .select('id, nombre, correo, rol')
      .single();

    if (error) {
      if (error.code === '23505')
        return res.status(400).json({ error: 'El correo ya está registrado' });
      throw error;
    }
    res.status(201).json({
      message: 'Cuenta creada. Espera aprobación del administrador.',
      usuario: data,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al registrar' });
  }
};

// ── LOGOUT ────────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    if (req.user) {
      removeSession(req.user.id);
      await supabase.from('bitacora_permisos').insert({
        usuario_id: req.user.id, accion: 'LOGOUT', descripcion: 'Cierre de sesión',
      });
    }
  } catch (_) {}
  res.json({ message: 'Sesión cerrada exitosamente' });
};

const verificarToken = (req, res) => {
  res.json({ valid: true, usuario: req.user });
};

module.exports = { login, logout, verificarToken, registroPublico };