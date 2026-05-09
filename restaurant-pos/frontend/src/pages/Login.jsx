import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PasswordInput from '../components/PasswordInput';
import { validarPassword, fortalezaPassword } from '../utils/password';

const API_URL = 'http://localhost:5000';

const redirigirPorRol = (rol, navigate) => {
  switch (rol) {
    case 'Admin':       return navigate('/dashboard');
    case 'Cajero':      return navigate('/caja');
    case 'Cocinero':    return navigate('/cocina');
    case 'Despachador': return navigate('/despacho');
    default:            return navigate('/dashboard');
  }
};

function Login() {
  const [modo, setModo] = useState('login'); // 'login' | 'registro'
  const [form, setForm] = useState({
    nombre: '', correo: '', password: '', confirmar: '', rol: 'Cajero',
  });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  /* ── Login ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, {
        correo: form.correo, password: form.password,
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('usuario', JSON.stringify(res.data.usuario));
      localStorage.setItem('lastActivity', Date.now().toString());
      redirigirPorRol(res.data.usuario.rol, navigate);
    } catch (err) {
      setError(err?.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  /* ── Registro ── */
  const handleRegistro = async (e) => {
    e.preventDefault();
    setError('');

    const errPwd = validarPassword(form.password);
    if (errPwd) return setError(errPwd);
    if (form.password !== form.confirmar) return setError('Las contraseñas no coinciden');

    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/registro-publico`, {
        nombre: form.nombre, correo: form.correo,
        password: form.password, rol: form.rol,
      });
      setSuccess('¡Cuenta creada! Espera que un administrador active tu acceso.');
      setModo('login');
      setForm({ nombre: '', correo: '', password: '', confirmar: '', rol: 'Cajero' });
    } catch (err) {
      setError(err?.response?.data?.error || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  const fortaleza = fortalezaPassword(form.password);

  const cambiarModo = (m) => { setModo(m); setError(''); setSuccess(''); };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-brand">
            <span>Sistema POS</span>
            Dulce Patojo
          </div>
          <p className="auth-tagline">
            Gestiona tu restaurante con elegancia. Control total de pedidos,
            usuarios y operaciones en un solo lugar.
          </p>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-container">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${modo === 'login' ? 'active' : ''}`}
              onClick={() => cambiarModo('login')}
            >
              Iniciar Sesión
            </button>
            <button
              className={`auth-tab ${modo === 'registro' ? 'active' : ''}`}
              onClick={() => cambiarModo('registro')}
            >
              Registrarse
            </button>
          </div>

          {error   && <div className="message error-message">{error}</div>}
          {success && <div className="message success-message">{success}</div>}

          {/* ── Panel Login ── */}
          {modo === 'login' ? (
            <>
              <p className="subtitle">Ingresa tus credenciales para continuar</p>
              <form onSubmit={handleLogin} className="auth-form">
                <div className="form-group">
                  <label htmlFor="login-correo">Correo Electrónico</label>
                  <input
                    id="login-correo"
                    type="email"
                    value={form.correo}
                    onChange={set('correo')}
                    placeholder="correo@ejemplo.com"
                    disabled={loading}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="login-pwd">Contraseña</label>
                  <PasswordInput
                    id="login-pwd"
                    value={form.password}
                    onChange={set('password')}
                    placeholder="Tu contraseña"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ marginTop: '8px' }}
                >
                  {loading ? 'Iniciando sesión…' : 'Iniciar Sesión →'}
                </button>
              </form>
            </>
          ) : (
            /* ── Panel Registro ── */
            <>
              <p className="subtitle">Crea tu cuenta para acceder al sistema</p>
              <form onSubmit={handleRegistro} className="auth-form">
                <div className="form-group">
                  <label>Nombre Completo</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={set('nombre')}
                    placeholder="Tu nombre"
                    disabled={loading}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Correo Electrónico</label>
                  <input
                    type="email"
                    value={form.correo}
                    onChange={set('correo')}
                    placeholder="correo@ejemplo.com"
                    disabled={loading}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Contraseña</label>
                  <PasswordInput
                    value={form.password}
                    onChange={set('password')}
                    placeholder="Mín. 8 car., mayúscula, número, especial"
                    disabled={loading}
                  />
                  {/* Indicador de fortaleza */}
                  {form.password && (
                    <div className="pwd-strength">
                      <div className="pwd-strength-bar">
                        {[1, 2, 3, 4].map((n) => (
                          <div
                            key={n}
                            className="pwd-strength-segment"
                            style={{
                              background: fortaleza.nivel >= n
                                ? fortaleza.color
                                : 'var(--border)',
                            }}
                          />
                        ))}
                      </div>
                      <span style={{ color: fortaleza.color, fontSize: '11px' }}>
                        {fortaleza.texto}
                      </span>
                    </div>
                  )}
                  <small className="pwd-hint">
                    8+ caracteres · Mayúscula · Minúscula · Número · Especial (!@#$%…)
                  </small>
                </div>
                <div className="form-group">
                  <label>Confirmar Contraseña</label>
                  <PasswordInput
                    value={form.confirmar}
                    onChange={set('confirmar')}
                    placeholder="Repite tu contraseña"
                    disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label>Rol Solicitado</label>
                  <select value={form.rol} onChange={set('rol')} disabled={loading}>
                    <option>Cajero</option>
                    <option>Cocinero</option>
                    <option>Despachador</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ marginTop: '8px' }}
                >
                  {loading ? 'Registrando…' : 'Crear Cuenta →'}
                </button>
              </form>
              <p className="auth-note">
                Tu cuenta quedará inactiva hasta que un administrador la apruebe.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;