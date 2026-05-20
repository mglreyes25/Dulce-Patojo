import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import PasswordInput from '../components/PasswordInput';
import { validarPassword, fortalezaPassword } from '../utils/password';
import { API_URL } from '../utils/api';

function Register() {
  const [form, setForm] = useState({
    nombre: '', correo: '', password: '', confirmarPassword: '', rol: 'Cajero',
  });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError(''); setSuccess('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    if (!form.nombre || !form.correo || !form.password || !form.confirmarPassword) {
      setError('Completa todos los campos');
      setLoading(false);
      return;
    }

    const errPwd = validarPassword(form.password);
    if (errPwd) { setError(errPwd); setLoading(false); return; }

    if (form.password !== form.confirmarPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    try {
      await axios.post(`${API_URL}/auth/registro-publico`, {
        nombre: form.nombre, correo: form.correo,
        password: form.password, rol: form.rol,
      });
      setSuccess('Registro exitoso. Redirigiendo…');
      setForm({ nombre: '', correo: '', password: '', confirmarPassword: '', rol: 'Cajero' });
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err?.response?.data?.error || 'Error al registrar usuario');
    } finally {
      setLoading(false);
    }
  };

  const fortaleza = fortalezaPassword(form.password);

  return (
    <div className="auth-page">
      <div className="auth-right" style={{ width: '100%', borderLeft: 'none' }}>
        <div className="auth-container">
          <h2>Crear Cuenta</h2>
          <p className="subtitle">Regístrate para comenzar</p>

          {error   && <div className="message error-message">{error}</div>}
          {success && <div className="message success-message">{success}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>Nombre Completo</label>
              <input
                type="text" name="nombre" value={form.nombre}
                onChange={handleChange} placeholder="Tu nombre" disabled={loading} required
              />
            </div>

            <div className="form-group">
              <label>Correo Electrónico</label>
              <input
                type="email" name="correo" value={form.correo}
                onChange={handleChange} placeholder="ejemplo@correo.com" disabled={loading} required
              />
            </div>

            <div className="form-group">
              <label>Contraseña</label>
              <PasswordInput
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Mín. 8 car., mayúscula, número, especial"
                disabled={loading}
              />
              {form.password && (
                <div className="pwd-strength">
                  <div className="pwd-strength-bar">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className="pwd-strength-segment"
                        style={{
                          background: fortaleza.nivel >= n ? fortaleza.color : 'var(--border)',
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
                name="confirmarPassword"
                value={form.confirmarPassword}
                onChange={handleChange}
                placeholder="Repite tu contraseña"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Rol</label>
              <select name="rol" value={form.rol} onChange={handleChange} disabled={loading}>
                <option value="Cajero">Cajero</option>
                <option value="Cocinero">Cocinero</option>
                <option value="Despachador">Despachador</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Registrando…' : 'Registrar'}
            </button>
          </form>

          <div className="auth-footer" style={{ marginTop: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            ¿Ya tienes cuenta? <Link to="/login" style={{ color: 'var(--gold)' }}>Inicia sesión</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;