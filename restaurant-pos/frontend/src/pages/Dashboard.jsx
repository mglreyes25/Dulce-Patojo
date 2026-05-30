import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Coffee, Package, Users, TrendingUp, ChefHat, Rocket, Map,
  CakeSlice, ClipboardList, Salad, PartyPopper, Clock, UserCheck, Circle,
} from 'lucide-react';
import { useInactividad } from '../hooks/useInactividad';
import { API_URL } from '../utils/api';
import Sidebar from '../components/Sidebar';
import useSocket from '../hooks/useSocket';

function Dashboard() {
  const [usuario, setUsuario] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const navigate = useNavigate();
  useInactividad();

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const u = localStorage.getItem('usuario');
    if (!u) { navigate('/login'); return; }
    setUsuario(JSON.parse(u));
  }, [navigate]);

  const fetchResumen = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/pedidos/resumen`, { headers });
      setStats(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const fetchOnlineUsers = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/usuarios/online`, { headers });
      setOnlineUsers(res.data || []);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (!usuario) return;
    fetchResumen();
    fetchOnlineUsers();
    const interval = setInterval(() => {
      fetchResumen();
      fetchOnlineUsers();
    }, 30000);
    return () => clearInterval(interval);
  }, [usuario]);

  useSocket({
    cambio_estado: () => {
      fetchResumen();
    },
    'usuarios-online': () => {
      fetchOnlineUsers();
    },
  });

  if (!usuario) return null;

  const accessItems = usuario.rol === 'Admin'
    ? [
        { to: '/usuarios', icon: Users, label: 'Usuarios', color: 'var(--blue)' },
        { to: '/productos', icon: CakeSlice, label: 'Productos', color: 'var(--amber)' },
        { to: '/inventario', icon: Package, label: 'Inventario', color: 'var(--green)' },
        { to: '/ingredientes', icon: Salad, label: 'Ingredientes', color: 'var(--caramel)' },
        { to: '/recetas', icon: ClipboardList, label: 'Recetas', color: 'var(--purple)' },
        { to: '/promociones', icon: PartyPopper, label: 'Promociones', color: 'var(--orange)' },
        { to: '/caja', icon: Coffee, label: 'Caja', color: 'var(--gold)' },
        { to: '/mesas', icon: Map, label: 'Mesas', color: 'var(--green)' },
        { to: '/cocina', icon: ChefHat, label: 'Cocina', color: 'var(--orange)' },
        { to: '/despacho', icon: Rocket, label: 'Despacho', color: 'var(--green)' },
        { to: '/reportes', icon: TrendingUp, label: 'Reportes', color: 'var(--purple)' },
      ]
    : [
        { to: '/productos', icon: CakeSlice, label: 'Productos', color: 'var(--amber)' },
        ...(['Admin', 'Cajero'].includes(usuario.rol)
          ? [{ to: '/caja', icon: Coffee, label: 'Caja', color: 'var(--gold)' }] : []),
        ...(['Admin', 'Cajero'].includes(usuario.rol)
          ? [{ to: '/mesas', icon: Map, label: 'Mesas', color: 'var(--green)' }] : []),
        ...(['Admin', 'Cocinero'].includes(usuario.rol)
          ? [{ to: '/cocina', icon: ChefHat, label: 'Cocina', color: 'var(--orange)' }] : []),
        ...(['Admin', 'Despachador'].includes(usuario.rol)
          ? [{ to: '/despacho', icon: Rocket, label: 'Despacho', color: 'var(--green)' }] : []),
        ...(['Admin', 'Cajero'].includes(usuario.rol)
          ? [{ to: '/promociones', icon: PartyPopper, label: 'Promociones', color: 'var(--orange)' }] : []),
      ];

  const today = new Date().toLocaleDateString('es-GT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const ventasDelDia = stats?.ventas_del_dia || [];

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="dashboard" />

      <main className="main-content">
        <div className="page-header">
          <div>
            <h2 className="page-title">Dashboard</h2>
            <p className="page-subtitle">
              Bienvenido, {usuario.nombre} — {today}
            </p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-icon">
              <Coffee size={20} className="stat-card-icon-svg" />
            </div>
            <div className="stat-card-value">{loading ? <span className="skeleton skeleton-line--value" style={{display:'inline-block'}}>&nbsp;</span> : stats?.pedidos_hoy ?? 0}</div>
            <div className="stat-card-label">Pedidos Hoy</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">
              <ChefHat size={20} className="stat-card-icon-svg" />
            </div>
            <div className="stat-card-value">{loading ? <span className="skeleton skeleton-line--value" style={{display:'inline-block'}}>&nbsp;</span> : stats?.en_preparacion ?? 0}</div>
            <div className="stat-card-label">En Preparación</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">
              <Clock size={20} className="stat-card-icon-svg" />
            </div>
            <div className="stat-card-value">{loading ? <span className="skeleton skeleton-line--value" style={{display:'inline-block'}}>&nbsp;</span> : stats?.listos ?? 0}</div>
            <div className="stat-card-label">Listos</div>
          </div>
          {(usuario.rol === 'Admin' || usuario.rol === 'Cajero') && (
            <div className="stat-card">
              <div className="stat-card-icon">
                <TrendingUp size={20} className="stat-card-icon-svg" />
              </div>
              <div className="stat-card-value">
                {loading ? <span className="skeleton skeleton-line--value" style={{display:'inline-block'}}>&nbsp;</span> : `$${(stats?.ventas_totales ?? 0).toFixed(2)}`}
              </div>
              <div className="stat-card-label">Ventas totales de hoy</div>
            </div>
          )}
          <div className="stat-card">
            <div className="stat-card-icon">
              <CakeSlice size={20} className="stat-card-icon-svg" />
            </div>
            <div className="stat-card-value">{loading ? <span className="skeleton skeleton-line--value" style={{display:'inline-block'}}>&nbsp;</span> : stats?.productos_activos ?? '—'}</div>
            <div className="stat-card-label">Productos Activos</div>
          </div>
          {usuario.rol === 'Admin' && (
            <div className="stat-card">
              <div className="stat-card-icon">
                <Users size={20} className="stat-card-icon-svg" />
              </div>
              <div className="stat-card-value">{loading ? <span className="skeleton skeleton-line--value" style={{display:'inline-block'}}>&nbsp;</span> : stats?.usuarios_activos ?? '—'}</div>
              <div className="stat-card-label">Usuarios Activos</div>
            </div>
          )}
        </div>

        {(usuario.rol === 'Admin' || usuario.rol === 'Cajero') && ventasDelDia.length > 0 && (
          <div className="card" style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 16 }}>
              <TrendingUp size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Ventas del Día
            </h3>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Ticket</th>
                    <th>Cliente</th>
                    <th>Monto</th>
                    <th>Método</th>
                    <th>Atendido por</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasDelDia.map(v => (
                    <tr key={v.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{v.hora}</td>
                      <td>#{v.ticket}</td>
                      <td>{v.cliente}</td>
                      <td style={{ fontWeight: 600 }}>${Number(v.monto).toFixed(2)}</td>
                      <td><span className="badge badge-info">{v.metodo}</span></td>
                      <td>{v.atendido_por}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {usuario.rol === 'Admin' && onlineUsers.length > 0 && (
          <div className="card" style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 16 }}>
              <UserCheck size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Usuarios en Línea
              <span className="badge badge-success" style={{ marginLeft: 8, fontSize: 11, verticalAlign: 'middle' }}>{onlineUsers.length}</span>
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {onlineUsers.map(u => (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--surface)', borderRadius: 8, padding: '8px 14px',
                  border: '1px solid var(--border)',
                }}>
                  <Circle size={10} fill="var(--green)" color="var(--green)" />
                  <span style={{ fontWeight: 500 }}>{u.nombre}</span>
                  <span className={`badge badge-${u.rol === 'Admin' ? 'primary' : u.rol === 'Cajero' ? 'info' : u.rol === 'Cocinero' ? 'purple' : 'success'}`} style={{ fontSize: 10 }}>
                    {u.rol}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="accesos-rapidos">
          <h3>Accesos Rápidos</h3>
          <div className="dashboard-accesos">
            {accessItems.map(item => (
              <Link key={item.to} to={item.to} className="acceso-card">
                <div className="acceso-icon" style={{ color: item.color }}>
                  <item.icon size={32} />
                </div>
                <span className="acceso-label">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
