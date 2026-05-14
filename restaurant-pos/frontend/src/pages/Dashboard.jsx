import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useInactividad } from '../hooks/useInactividad';
import Sidebar from '../components/Sidebar';

function Dashboard() {
  const [usuario, setUsuario] = useState(null);
  const navigate = useNavigate();
  useInactividad();

  useEffect(() => {
    const u = localStorage.getItem('usuario');
    if (!u) { navigate('/login'); return; }
    setUsuario(JSON.parse(u));
  }, [navigate]);

  if (!usuario) return null;

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="dashboard" />

      <main className="main-content">
        <div className="page-header">
          <div>
            <h2>Dashboard</h2>
            <p>
              Bienvenido, {usuario.nombre} —{' '}
              {new Date().toLocaleDateString('es-GT', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
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
          {['Admin', 'Cajero'].includes(usuario.rol) && (
            <Link to="/caja" className="acceso-card">
              <span className="acceso-icon">🧾</span>
              <span className="acceso-label">Caja</span>
            </Link>
          )}
          {usuario.rol === 'Admin' && (
            <Link to="/inventario" className="acceso-card">
              <span className="acceso-icon">📦</span>
              <span className="acceso-label">Inventario</span>
            </Link>
          )}
          {['Admin', 'Cocinero'].includes(usuario.rol) && (
            <div className="acceso-card disabled">
              <span className="acceso-icon">👨‍🍳</span>
              <span className="acceso-label">Cocina</span>
              <span className="acceso-soon">Sprint 4</span>
            </div>
          )}
          {['Admin', 'Despachador'].includes(usuario.rol) && (
            <div className="acceso-card disabled">
              <span className="acceso-icon">🚀</span>
              <span className="acceso-label">Despacho</span>
              <span className="acceso-soon">Sprint 4</span>
            </div>
          )}
          {usuario.rol === 'Admin' && (
            <div className="acceso-card disabled">
              <span className="acceso-icon">📈</span>
              <span className="acceso-label">Reportes</span>
              <span className="acceso-soon">Sprint 5</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;