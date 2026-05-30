import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, LogOut, User, Shield, Mail, Info } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useInactividad } from '../hooks/useInactividad';
import Sidebar from '../components/Sidebar';
import { disconnectSocket } from '../hooks/useSocket';

function Configuracion() {
  const [usuario, setUsuario] = useState(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  useInactividad();

  useEffect(() => {
    const u = localStorage.getItem('usuario');
    if (!u) { navigate('/login'); return; }
    setUsuario(JSON.parse(u));
  }, [navigate]);

  const handleLogout = () => {
    disconnectSocket();
    localStorage.clear();
    navigate('/login');
  };

  if (!usuario) return null;

  const initials = (nombre) => {
    if (!nombre) return '?';
    return nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="configuracion" />
      <main className="main-content config-page">
        <div className="page-header">
          <div className="page-header-left">
            <h2 className="page-title">Configuración</h2>
            <p className="page-subtitle">Personaliza tu experiencia en el sistema</p>
          </div>
        </div>

        <div className="config-section">
          <div className="config-card">
            <h3 className="config-section-title">Apariencia</h3>
            <p className="config-section-desc">
              Elige cómo se ve el sistema. Tu preferencia se guarda automáticamente.
            </p>
            <div className="config-theme-toggle">
              <div className="config-theme-info">
                <div className="config-theme-swatch" />
                <div className="config-theme-text">
                  <h4>Tema {theme === 'dark' ? 'Oscuro' : 'Claro'}</h4>
                  <p>Actualmente: {theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}</p>
                </div>
              </div>
              <button
                className={`config-toggle ${theme === 'light' ? 'active' : ''}`}
                onClick={toggleTheme}
                aria-label="Cambiar tema"
                title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              >
                <div className="config-toggle-knob">
                  {theme === 'dark' ? <Moon /> : <Sun />}
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="config-section">
          <div className="config-card">
            <h3 className="config-section-title">Tu Perfil</h3>
            <p className="config-section-desc">
              Información de tu cuenta
            </p>
            <div className="config-profile-row">
              <div className="config-profile-avatar">
                {initials(usuario.nombre)}
              </div>
              <div className="config-profile-info">
                <div className="config-profile-name">{usuario.nombre}</div>
                <div className="config-profile-meta">
                  <Shield size={14} />
                  <span className={`badge badge-${usuario.rol === 'Admin' ? 'primary' : 'info'}`}>
                    {usuario.rol}
                  </span>
                  <Mail size={14} />
                  <span>{usuario.correo || 'Sin correo'}</span>
                </div>
              </div>
            </div>
            <div className="config-profile-divider" />
            <button className="btn btn-danger" onClick={handleLogout} style={{ width: '100%' }}>
              <LogOut size={16} />
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="config-section">
          <div className="config-card">
            <h3 className="config-section-title">Información del Sistema</h3>
            <div className="config-profile-row">
              <Info size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <div className="config-profile-info">
                <div className="config-profile-name">Dulce Patojo SAC</div>
                <div className="config-profile-meta">
                  <span>Versión 1.0.0</span>
                  <span>Sistema Administrativo y Contable para cafetería</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Configuracion;
