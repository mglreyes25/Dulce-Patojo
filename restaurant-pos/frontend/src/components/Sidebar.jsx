import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const rolColor = (rol) =>
  ({ Admin: 'warning', Cajero: 'primary', Cocinero: 'purple', Despachador: 'success' }[rol] || 'primary');

/**
 * Sidebar reutilizable con hamburguesa y soporte responsive.
 * Props:
 *  - usuario: objeto con { nombre, rol }
 *  - activeRoute: 'dashboard' | 'usuarios' | 'productos' | ...
 */
export default function Sidebar({ usuario, activeRoute }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);   // desktop: colapsado o no
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile: drawer abierto

  // Cerrar drawer al cambiar tamaño a desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setDrawerOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => { localStorage.clear(); navigate('/login'); };

  const navItems = [
    { to: '/dashboard', icon: '📊', label: 'Dashboard',  key: 'dashboard' },
    ...(usuario?.rol === 'Admin'
      ? [{ to: '/usuarios', icon: '👥', label: 'Usuarios', key: 'usuarios' }]
      : []),
    { to: '/productos', icon: '🍔', label: 'Productos', key: 'productos' },
    { to: '#pedidos',   icon: '📦', label: 'Pedidos',   key: 'pedidos',  disabled: true },
    { to: '#reportes',  icon: '📈', label: 'Reportes',  key: 'reportes', disabled: true },
  ];

  const SidebarContent = ({ onLinkClick }) => (
    <>
      <div className="sidebar-logo">
        {!collapsed && (
          <>
            <h1>Dulce Patojo</h1>
            <p>Sistema POS</p>
          </>
        )}
      </div>

      <nav>
        <ul>
          {navItems.map((item) => (
            <li key={item.key} title={collapsed ? item.label : undefined}>
              {item.disabled ? (
                <a href={item.to} className="nav-disabled" onClick={(e) => e.preventDefault()}>
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && <span className="nav-label">{item.label}</span>}
                </a>
              ) : (
                <Link
                  to={item.to}
                  className={activeRoute === item.key ? 'active' : ''}
                  onClick={onLinkClick}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && <span className="nav-label">{item.label}</span>}
                </Link>
              )}
            </li>
          ))}
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
          className="btn-logout"
          onClick={handleLogout}
          title={collapsed ? 'Cerrar Sesión' : undefined}
        >
          🚪{!collapsed && ' Cerrar Sesión'}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Botón hamburguesa flotante (móvil) ── */}
      <button
        className="hamburger-btn hamburger-mobile"
        onClick={() => setDrawerOpen(true)}
        aria-label="Abrir menú"
      >
        <HamburgerIcon />
      </button>

      {/* ── Drawer overlay (móvil) ── */}
      {drawerOpen && (
        <div className="sidebar-overlay" onClick={() => setDrawerOpen(false)}>
          <aside className="sidebar sidebar-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-drawer-header">
              <button
                className="hamburger-btn"
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
              >
                <CloseIcon />
              </button>
            </div>
            <SidebarContent onLinkClick={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Sidebar desktop ── */}
      <aside className={`sidebar sidebar-desktop ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <button
          className="hamburger-btn hamburger-desktop"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <HamburgerIcon />
        </button>
        <SidebarContent onLinkClick={undefined} />
      </aside>
    </>
  );
}

const HamburgerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="5"  x2="17" y2="5"  />
    <line x1="3" y1="10" x2="17" y2="10" />
    <line x1="3" y1="15" x2="17" y2="15" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="4" y1="4" x2="16" y2="16" />
    <line x1="16" y1="4" x2="4" y2="16" />
  </svg>
);