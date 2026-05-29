import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LogIn, AlertTriangle } from 'lucide-react';

function SesionExpirada() {
  const navigate = useNavigate();
  const [cuentaRegresiva, setCuentaRegresiva] = useState(15);

  useEffect(() => {
    if (cuentaRegresiva <= 0) {
      navigate('/login');
      return;
    }
    const timer = setTimeout(() => setCuentaRegresiva((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cuentaRegresiva, navigate]);

  const handleReingresar = () => {
    navigate('/login');
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
            <div className="auth-header-icon" style={{ background: 'rgba(231,76,60,0.15)' }}>
              <Clock size={22} color="#e74c3c" />
            </div>
            <h2 className="auth-title" style={{ color: '#e74c3c' }}>Sesión Expirada</h2>
            <p className="auth-subtitle">
              Tu sesión ha caducado por inactividad
            </p>
          </div>

          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)',
            borderRadius: 10, padding: '14px 16px', marginBottom: 24,
          }}>
            <AlertTriangle size={20} color="#e74c3c" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, color: '#e74c3c', fontWeight: 600, margin: '0 0 4px' }}>
                Tu token de autenticación ha expirado
              </p>
              <p style={{
                fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0,
              }}>
                Por motivos de seguridad, tu sesión se cerró automáticamente después de un periodo de inactividad.
                Deberás iniciar sesión nuevamente para acceder al sistema.
              </p>
            </div>
          </div>

          <p style={{
            color: 'var(--text-muted)',
            fontSize: '14px',
            lineHeight: 1.6,
            textAlign: 'center',
            marginBottom: '24px',
          }}>
            Serás redirigido al inicio de sesión en <strong style={{ color: 'var(--text)' }}>{cuentaRegresiva}</strong> segundo(s).
          </p>

          <button
            className="btn btn-primary btn-full"
            onClick={handleReingresar}
          >
            <LogIn size={18} />
            Volver a iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

export default SesionExpirada;
