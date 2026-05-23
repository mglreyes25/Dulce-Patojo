import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3, Users, CakeSlice, Package, Salad, ClipboardList,
  PartyPopper, Coffee, Map, ChefHat, Rocket, TrendingUp, LogOut,
  Menu, X,
} from 'lucide-react';

const rolColor = (rol) =>
  ({ Admin: 'warning', Cajero: 'primary', Cocinero: 'purple', Despachador: 'success' }[rol] || 'primary');

const SidebarContent = ({ usuario, activeRoute, collapsed, navItems, handleLogout, onLinkClick }) => (
  <>
    <div className="sidebar-logo">
      {!collapsed && (
        <a href="/dashboard" className="sidebar-logo-link">
          <div className="sidebar-logo-container">
            <img src="/images/logo.jpg" alt="Dulce Patojo" className="sidebar-logo-img" />
            <span className="sidebar-logo-text">Dulce patojo</span>
          </div>
        </a>
      )}
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
      {!collapsed && (
        <div className="sidebar-user">
          <span className="sidebar-user-name">{usuario?.nombre}</span>
          <span className={`badge badge-${rolColor(usuario?.rol)}`}>{usuario?.rol}</span>
        </div>
      )}
      <button
        className={`btn-logout${collapsed ? ' btn-logout--collapsed' : ''}`}
        onClick={handleLogout}
        title={collapsed ? 'Cerrar Sesión' : undefined}
      >
        <LogOut size={16} className="btn-logout-icon" />
        {!collapsed && ' Cerrar Sesión'}
      </button>
    </div>
  </>
);

export default function Sidebar({ usuario, activeRoute }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setDrawerOpen(false);
    };
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
    { to: '#reportes', icon: TrendingUp, label: 'Reportes', key: 'reportes', disabled: true },
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
            <div className="sidebar-drawer-header">
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
            />
          </aside>
        </div>
      )}

      <aside className={`sidebar sidebar-desktop${collapsed ? ' sidebar-collapsed' : ''}`}>
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
        />
      </aside>
    </>
  );
}
