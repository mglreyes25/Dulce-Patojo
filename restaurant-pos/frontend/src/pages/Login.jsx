import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, Loader2 } from 'lucide-react';
import PasswordInput from '../components/PasswordInput';

import { API_URL } from '../utils/api';

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
  const [form, setForm] = useState({ correo: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

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
      setError(err?.response?.data?.error || 'Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-left-content">
          <img src="/images/logo.jpg" alt="Dulce Patojo" className="auth-logo" />
          <h1 className="auth-brand">Dulce Patojo</h1>
          <p className="auth-tagline">
            Sistema Administrativo y Contable para tu cafetería.
            Control total de pedidos, usuarios y operaciones en un solo lugar.
          </p>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-header">
            <h2 className="auth-title">Iniciar Sesión</h2>
            <p className="auth-subtitle">Ingresa tus credenciales para continuar</p>
          </div>

          {error && <div className="message error-message">{error}</div>}

          <form onSubmit={handleLogin} className="auth-form" aria-busy={loading}>
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
              className="btn btn-primary btn-full"
              disabled={loading}
            >
              <span className="btn-content">
                {loading && <Loader2 size={18} className="btn-spinner" />}
                <span>{loading ? 'Iniciando sesión…' : 'Iniciar Sesión'}</span>
                {!loading && <ArrowRight size={18} className="btn-icon" />}
              </span>
            </button>
          </form>

          <p className="auth-note">
            ¿No tienes acceso? Contacta al administrador del sistema.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
