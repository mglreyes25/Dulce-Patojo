import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';

const API_URL = 'http://localhost:5000';

const rolBadge = (rol) => {
  const map = { Admin: 'badge-warning', Cajero: 'badge-primary', Cocinero: 'badge-purple', Despachador: 'badge-success' };
  return map[rol] || 'badge-primary';
};

function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: '', correo: '', password: '', rol: 'Cajero' });
  const [guardando, setGuardando] = useState(false);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('Todos');
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const headers = { Authorization: `Bearer ${token}` };

  useInactividad();

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (usuario.rol !== 'Admin') { navigate('/dashboard'); return; }
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_URL}/usuarios`, { headers });
      setUsuarios(res.data || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.clear(); navigate('/login');
      }
      setError('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  // Filtrado en tiempo real
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      const matchBusqueda = busqueda === '' ||
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.correo.toLowerCase().includes(busqueda.toLowerCase());
      const matchRol = filtroRol === 'Todos' || u.rol === filtroRol;
      const matchEstado = filtroEstado === 'Todos' ||
        (filtroEstado === 'Activo' && u.activo) ||
        (filtroEstado === 'Inactivo' && !u.activo);
      return matchBusqueda && matchRol && matchEstado;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  const abrirCrear = () => {
    setEditando(null);
    setForm({ nombre: '', correo: '', password: '', rol: 'Cajero' });
    setError('');
    setShowModal(true);
  };

  const abrirEditar = (u) => {
    setEditando(u);
    setForm({ nombre: u.nombre, correo: u.correo, password: '', rol: u.rol });
    setError('');
    setShowModal(true);
  };

  const cerrarModal = () => { setShowModal(false); setEditando(null); setError(''); };

  const handleGuardar = async () => {
    if (!form.nombre || !form.correo || (!editando && !form.password)) {
      setError('Completa todos los campos obligatorios');
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        const payload = { nombre: form.nombre, correo: form.correo, rol: form.rol };
        if (form.password) payload.password = form.password;
        await axios.put(`${API_URL}/usuarios/${editando.id}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/usuarios`, form, { headers });
      }
      cerrarModal();
      cargarUsuarios();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleToggle = async (u) => {
    try {
      const accion = u.activo ? 'inactivar' : 'activar';
      await axios.patch(`${API_URL}/usuarios/${u.id}/${accion}`, {}, { headers });
      cargarUsuarios();
    } catch {
      setError('Error al cambiar estado del usuario');
    }
  };

  const handleLogout = () => { localStorage.clear(); navigate('/login'); };

  return (
    <div className="dashboard-page">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Dulce Patojo</h1>
          <p>Sistema POS</p>
        </div>
        <nav>
          <ul>
            <li><Link to="/dashboard">📊 Dashboard</Link></li>
            <li><Link to="/usuarios" className="active">👥 Usuarios</Link></li>
            <li><a href="#pedidos">📦 Pedidos</a></li>
            <li><a href="#productos">🍔 Productos</a></li>
            <li><a href="#reportes">📈 Reportes</a></li>
          </ul>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-user-name">{usuario.nombre}</span>
            <span className="badge badge-warning">Admin</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>🚪 Cerrar Sesión</button>
        </div>
      </aside>

      <main className="main-content">
        <div className="page-header">
          <div>
            <h2>Gestión de Usuarios</h2>
            <p>Administra los accesos al sistema · {usuarios.length} usuario(s) registrado(s)</p>
          </div>
          <button className="btn btn-primary" onClick={abrirCrear}>+ Nuevo Usuario</button>
        </div>

        {error && !showModal && <div className="message error-message">{error}</div>}

        {/* Filtros */}
        <div className="filtros-bar">
          <input
            className="filtro-input"
            type="text"
            placeholder="🔍 Buscar por nombre o correo..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <select className="filtro-select" value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
            <option value="Todos">Todos los roles</option>
            <option>Admin</option>
            <option>Cajero</option>
            <option>Cocinero</option>
            <option>Despachador</option>
          </select>
          <select className="filtro-select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="Todos">Todos los estados</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
          {(busqueda || filtroRol !== 'Todos' || filtroEstado !== 'Todos') && (
            <button className="filtro-clear" onClick={() => { setBusqueda(''); setFiltroRol('Todos'); setFiltroEstado('Todos'); }}>
              ✕ Limpiar
            </button>
          )}
        </div>

        <div className="card">
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Cargando usuarios...</p>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="empty-state">
              <p>{usuarios.length === 0 ? 'No hay usuarios registrados' : 'No se encontraron resultados'}</p>
              {usuarios.length === 0 && <button className="btn btn-primary" onClick={abrirCrear}>Crear primer usuario</button>}
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.nombre}</strong></td>
                    <td style={{ color: 'var(--text-muted)' }}>{u.correo}</td>
                    <td><span className={`badge ${rolBadge(u.rol)}`}>{u.rol}</span></td>
                    <td>
                      <span className={`badge ${u.activo ? 'badge-success' : 'badge-danger'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button className="btn-small btn-edit" onClick={() => abrirEditar(u)}>✏️ Editar</button>
                      <button
                        className={`btn-small ${u.activo ? 'btn-delete' : 'btn-success'}`}
                        onClick={() => handleToggle(u)}
                      >
                        {u.activo ? '🔒 Inactivar' : '✅ Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {showModal && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editando ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
            {error && <div className="message error-message">{error}</div>}
            <div className="form-group">
              <label>Nombre *</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre completo" />
            </div>
            <div className="form-group">
              <label>Correo *</label>
              <input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} placeholder="correo@ejemplo.com" />
            </div>
            <div className="form-group">
              <label>Contraseña {editando ? '(vacío = sin cambios)' : '*'}</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label>Rol *</label>
              <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                <option>Admin</option>
                <option>Cajero</option>
                <option>Cocinero</option>
                <option>Despachador</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="btn" style={{ flex: 1, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }} onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Usuarios;