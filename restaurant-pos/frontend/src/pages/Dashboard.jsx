import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useInactividad } from '../hooks/useInactividad';

const rolColor = (rol) => ({ Admin:'warning', Cajero:'primary', Cocinero:'purple', Despachador:'success' }[rol] || 'primary');

function Dashboard() {
  const [usuario, setUsuario] = useState(null);
  const navigate = useNavigate();
  useInactividad();

  useEffect(() => {
    const u = localStorage.getItem('usuario');
    if (!u) { navigate('/login'); return; }
    setUsuario(JSON.parse(u));
  }, [navigate]);

  const handleLogout = () => { localStorage.clear(); navigate('/login'); };

  if (!usuario) return null;

  return (
    <div className="dashboard-page">
      <aside className="sidebar">
        <div className="sidebar-logo"><h1>Dulce Patojo</h1><p>Sistema POS</p></div>
        <nav>
          <ul>
            <li><Link to="/dashboard" className="active">📊 Dashboard</Link></li>
            {usuario.rol === 'Admin' && <li><Link to="/usuarios">👥 Usuarios</Link></li>}
            <li><Link to="/productos">🍔 Productos</Link></li>
            <li><a href="#pedidos">📦 Pedidos</a></li>
            <li><a href="#reportes">📈 Reportes</a></li>
          </ul>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-user-name">{usuario.nombre}</span>
            <span className={`badge badge-${rolColor(usuario.rol)}`}>{usuario.rol}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>🚪 Cerrar Sesión</button>
        </div>
      </aside>

      <main className="main-content">
        <div className="page-header">
          <div>
            <h2>Dashboard</h2>
            <p>Bienvenido, {usuario.nombre} — {new Date().toLocaleDateString('es-GT', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📦</div>
            <div className="stat-value">0</div>
            <div className="stat-label">Pedidos Hoy</div>
          </div>
          {usuario.rol === 'Admin' && (
            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-value">$0.00</div>
              <div className="stat-label">Ventas Totales</div>
            </div>
          )}
          <div className="stat-card">
            <div className="stat-icon">🍔</div>
            <div className="stat-value">—</div>
            <div className="stat-label">Productos Activos</div>
          </div>
          {usuario.rol === 'Admin' && (
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-value">—</div>
              <div className="stat-label">Usuarios Activos</div>
            </div>
          )}
        </div>

        <div className="dashboard-accesos">
          {usuario.rol === 'Admin' && (
            <Link to="/usuarios" className="acceso-card">
              <span className="acceso-icon">👥</span>
              <span className="acceso-label">Usuarios</span>
            </Link>
          )}
          <Link to="/productos" className="acceso-card">
            <span className="acceso-icon">🍔</span>
            <span className="acceso-label">Productos</span>
          </Link>
          <div className="acceso-card disabled">
            <span className="acceso-icon">📦</span>
            <span className="acceso-label">Pedidos</span>
            <span className="acceso-soon">Sprint 3</span>
          </div>
          <div className="acceso-card disabled">
            <span className="acceso-icon">📈</span>
            <span className="acceso-label">Reportes</span>
            <span className="acceso-soon">Sprint 5</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;