import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3, Users, CakeSlice, Package, Salad, ClipboardList,
  PartyPopper, Coffee, Map, ChefHat, Rocket, TrendingUp, LogOut,
  Menu, X, Settings,
} from 'lucide-react';
import useSocket from '../hooks/useSocket';

const rolColor = (rol) =>
  ({ Admin: 'primary', Cajero: 'info', Cocinero: 'purple', Despachador: 'success' }[rol] || 'primary');

const rolInitials = (nombre) => {
  if (!nombre) return '?';
  return nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
};

const SidebarContent = ({ usuario, activeRoute, collapsed, navItems, handleLogout, onLinkClick, socketConnected }) => (
  <>
    <div className="sidebar-logo">
      <img src="/images/logo.jpg" alt="Dulce Patojo" className="sidebar-logo-img" loading="lazy" />
      {!collapsed && <span className="sidebar-logo-text">Dulce Patojo</span>}
    </div>

    <nav>
      <ul>
        {navItems.map((item) => {
          const IconComp = item.icon;
          return (
            <li key={item.key} title={collapsed ? item.label : undefined}>
              {item.disabled ? (
                <a href={item.to} className="nav-disabled" onClick={(e) => e.preventDefault()}>
                  <span className="nav-icon"><IconComp size={18} /></span>
                  {!collapsed && <span className="nav-label">{item.label}</span>}
                  {!collapsed && <span className="nav-soon">Pronto</span>}
                </a>
              ) : (
                <Link
                  to={item.to}
                  className={activeRoute === item.key ? 'active' : ''}
                  onClick={onLinkClick}
                >
                  <span className="nav-icon"><IconComp size={18} /></span>
                  {!collapsed && <span className="nav-label">{item.label}</span>}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>

    <div className="sidebar-footer">
      {!collapsed ? (
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {rolInitials(usuario?.nombre)}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{usuario?.nombre}</span>
            <span className={`badge badge-${rolColor(usuario?.rol)}`}>{usuario?.rol}</span>
          </div>
          <span className={`socket-indicator ${socketConnected ? 'connected' : 'disconnected'}`}
                title={socketConnected ? 'En línea' : 'Sin conexión'} />
        </div>
      ) : (
        <div className="sidebar-user" style={{ justifyContent: 'center' }}>
          <span className={`socket-indicator ${socketConnected ? 'connected' : 'disconnected'}`}
                title={socketConnected ? 'En línea' : 'Sin conexión'} />
        </div>
      )}
      <button
        className={`btn-logout${collapsed ? ' btn-logout--collapsed' : ''}`}
        onClick={handleLogout}
        title={collapsed ? 'Cerrar Sesión' : undefined}
      >
        <LogOut size={16} />
        {!collapsed && 'Cerrar Sesión'}
      </button>
    </div>
  </>
);

export default function Sidebar({ usuario, activeRoute }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const { socket: socketRef } = useSocket();

  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    setSocketConnected(s.connected);
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, [socketRef]);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w > 1024) {
        setCollapsed(false);
        setDrawerOpen(false);
      } else if (w > 768) {
        setCollapsed(true);
        setDrawerOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => { localStorage.clear(); navigate('/login'); };

  const navItems = [
    { to: '/dashboard', icon: BarChart3, label: 'Dashboard', key: 'dashboard' },
    ...(usuario?.rol === 'Admin'
      ? [{ to: '/usuarios', icon: Users, label: 'Usuarios', key: 'usuarios' }]
      : []),
    { to: '/productos', icon: CakeSlice, label: 'Productos', key: 'productos' },
    ...(usuario?.rol === 'Admin'
      ? [{ to: '/inventario', icon: Package, label: 'Inventario', key: 'inventario' }]
      : []),
    ...(usuario?.rol === 'Admin'
      ? [{ to: '/ingredientes', icon: Salad, label: 'Ingredientes', key: 'ingredientes' }]
      : []),
    ...(usuario?.rol === 'Admin'
      ? [{ to: '/recetas', icon: ClipboardList, label: 'Recetas', key: 'recetas' }]
      : []),
    ...(['Admin', 'Cajero'].includes(usuario?.rol)
      ? [{ to: '/promociones', icon: PartyPopper, label: 'Promociones', key: 'promociones' }]
      : []),
    ...(['Admin', 'Cajero'].includes(usuario?.rol)
      ? [{ to: '/caja', icon: Coffee, label: 'Caja', key: 'caja' }]
      : []),
    ...(['Admin', 'Cajero'].includes(usuario?.rol)
      ? [{ to: '/mesas', icon: Map, label: 'Mesas', key: 'mesas' }]
      : []),
    ...(['Admin', 'Cocinero'].includes(usuario?.rol)
      ? [{ to: '/cocina', icon: ChefHat, label: 'Cocina', key: 'cocina' }]
      : []),
    ...(['Admin', 'Despachador'].includes(usuario?.rol)
      ? [{ to: '/despacho', icon: Rocket, label: 'Despacho', key: 'despacho' }]
      : []),
    ...(usuario?.rol === 'Admin'
      ? [{ to: '/reportes', icon: TrendingUp, label: 'Reportes', key: 'reportes' }]
      : []),
    { to: '/configuracion', icon: Settings, label: 'Configuración', key: 'configuracion' },
  ];

  return (
    <>
      <button
        className="hamburger-btn hamburger-mobile"
        onClick={() => setDrawerOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {drawerOpen && (
        <div className="sidebar-overlay" onClick={() => setDrawerOpen(false)}>
          <aside className="sidebar sidebar-drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 8px 0' }}>
              <button
                className="hamburger-btn"
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
              >
                <X size={20} />
              </button>
            </div>
            <SidebarContent
              usuario={usuario} activeRoute={activeRoute}
              collapsed={false} navItems={navItems}
              handleLogout={handleLogout} onLinkClick={() => setDrawerOpen(false)}
              socketConnected={socketConnected}
            />
          </aside>
        </div>
      )}

      <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
        <button
          className="hamburger-btn hamburger-desktop"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <Menu size={20} />
        </button>
        <SidebarContent
          usuario={usuario} activeRoute={activeRoute}
          collapsed={collapsed} navItems={navItems}
          handleLogout={handleLogout} onLinkClick={undefined}
          socketConnected={socketConnected}
        />
      </aside>
    </>
  );
}
