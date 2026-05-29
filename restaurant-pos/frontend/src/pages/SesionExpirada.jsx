import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LogIn } from 'lucide-react';

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
            <div className="auth-header-icon">
              <Clock size={22} />
            </div>
            <h2 className="auth-title">Sesión Expirada</h2>
            <p className="auth-subtitle">
              Tu sesión ha caducado por inactividad
            </p>
          </div>

          <p style={{
            color: 'var(--text-muted)',
            fontSize: '14px',
            lineHeight: 1.6,
            textAlign: 'center',
            marginBottom: '24px',
          }}>
            Por motivos de seguridad, tu sesión se cerró automáticamente.
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
