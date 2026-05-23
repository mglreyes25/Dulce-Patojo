import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import { API_URL } from '../utils/api';
import Sidebar from '../components/Sidebar';
import Pagination from '../components/Pagination';

const rolBadge = (rol) => {
  const map = {
    Admin: 'badge-warning', Cajero: 'badge-primary',
    Cocinero: 'badge-purple', Despachador: 'badge-success',
  };
  return map[rol] || 'badge-primary';
};

function Usuarios() {
  const [usuarios, setUsuarios]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editando, setEditando]     = useState(null);
  const [form, setForm]             = useState({
    nombre: '', correo: '', password: '', confirmarPassword: '', rol: 'Cajero',
  });
  const [guardando, setGuardando]   = useState(false);

  // Inactivar modal
  const [showInactivarModal, setShowInactivarModal] = useState(false);
  const [inactivarTarget, setInactivarTarget]       = useState(null);
  const [motivoInactivar, setMotivoInactivar]       = useState('');

  // Filtros
  const [busqueda, setBusqueda]         = useState('');
  const [filtroRol, setFiltroRol]       = useState('Todos');
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  // Paginación
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [busqueda, filtroRol, filtroEstado]);

  const navigate = useNavigate();
  const token   = localStorage.getItem('token');
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
    return usuarios.filter((u) => {
      const matchBusqueda =
        busqueda === '' ||
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.correo.toLowerCase().includes(busqueda.toLowerCase());
      const matchRol    = filtroRol === 'Todos' || u.rol === filtroRol;
      const matchEstado =
        filtroEstado === 'Todos' ||
        (filtroEstado === 'Activo' && u.activo) ||
        (filtroEstado === 'Inactivo' && !u.activo);
      return matchBusqueda && matchRol && matchEstado;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  const totalPages = Math.max(1, Math.ceil(usuariosFiltrados.length / ITEMS_PER_PAGE));
  const paginados = usuariosFiltrados.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const abrirCrear = () => {
    setEditando(null);
    setForm({ nombre: '', correo: '', password: '', confirmarPassword: '', rol: 'Cajero' });
    setError('');
    setShowModal(true);
  };

  const abrirEditar = (u) => {
    setEditando(u);
    setForm({ nombre: u.nombre, correo: u.correo, password: '', confirmarPassword: '', rol: u.rol });
    setError('');
    setShowModal(true);
  };

  const cerrarModal = () => { setShowModal(false); setEditando(null); setError(''); };

  const handleGuardar = async () => {
    if (!form.nombre || !form.correo || (!editando && !form.password)) {
      setError('Completa todos los campos obligatorios');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.correo)) {
      setError('El formato del correo no es válido');
      return;
    }

    // Validar contraseña solo si se está ingresando una
    if (form.password) {
      const errPwd = validarPassword(form.password);
      if (errPwd) { setError(errPwd); return; }

      // Al crear siempre, al editar solo si escribió contraseña nueva
      if (form.password !== form.confirmarPassword) {
        setError('Las contraseñas no coinciden');
        return;
      }
    }

    setGuardando(true);
    try {
      if (editando) {
        const payload = { nombre: form.nombre, correo: form.correo, rol: form.rol };
        if (form.password) payload.password = form.password;
        await axios.put(`${API_URL}/usuarios/${editando.id}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/usuarios`, {
          nombre: form.nombre, correo: form.correo,
          password: form.password, rol: form.rol,
        }, { headers });
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
    if (u.activo) {
      setInactivarTarget(u);
      setMotivoInactivar('');
      setShowInactivarModal(true);
    } else {
      try {
        await axios.patch(`${API_URL}/usuarios/${u.id}/activar`, {}, { headers });
        cargarUsuarios();
      } catch {
        setError('Error al activar usuario');
      }
    }
  };

  const confirmarInactivar = async () => {
    if (!motivoInactivar.trim()) {
      setError('Debes escribir una explicación');
      return;
    }
    try {
      await axios.patch(`${API_URL}/usuarios/${inactivarTarget.id}/inactivar`,
        { descripcion: motivoInactivar.trim() }, { headers });
      setShowInactivarModal(false);
      setInactivarTarget(null);
      cargarUsuarios();
    } catch {
      setError('Error al inactivar usuario');
    }
  };

  // Mostrar confirmación solo si se está creando o si se ingresó una nueva contraseña al editar
  const mostrarConfirmar = !editando || !!form.password;

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="usuarios" />

      <main className="main-content">
        <div className="page-header">
          <div>
            <h2>Gestión de Usuarios</h2>
            <p>
              Administra los accesos al sistema · {usuarios.length} usuario(s) registrado(s)
            </p>
          </div>
          <button className="btn btn-primary" onClick={abrirCrear}>
            + Nuevo Usuario
          </button>
        </div>

        {error && !showModal && <div className="message error-message">{error}</div>}

        {/* Filtros */}
        <div className="filtros-bar">
          <input
            className="filtro-input"
            type="text"
            placeholder="🔍 Buscar por nombre o correo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <select
            className="filtro-select"
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value)}
          >
            <option value="Todos">Todos los roles</option>
            <option>Admin</option>
            <option>Cajero</option>
            <option>Cocinero</option>
            <option>Despachador</option>
          </select>
          <select
            className="filtro-select"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="Todos">Todos los estados</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
          {(busqueda || filtroRol !== 'Todos' || filtroEstado !== 'Todos') && (
            <button
              className="filtro-clear"
              onClick={() => { setBusqueda(''); setFiltroRol('Todos'); setFiltroEstado('Todos'); }}
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        <div className="card">
          {loading ? (
            <p className="loading-text">Cargando usuarios…</p>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="empty-state">
              <p>{usuarios.length === 0 ? 'No hay usuarios registrados' : 'No se encontraron resultados'}</p>
              {usuarios.length === 0 && (
                <button className="btn btn-primary" onClick={abrirCrear}>
                  Crear primer usuario
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive">
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
                  {paginados.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.nombre}</strong></td>
                      <td style={{ color: 'var(--text-muted)' }}>{u.correo}</td>
                      <td>
                        <span className={`badge ${rolBadge(u.rol)}`}>{u.rol}</span>
                      </td>
                      <td>
                        <span className={`badge ${u.activo ? 'badge-success' : 'badge-danger'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="td-actions">
                        <button className="btn-small btn-edit" onClick={() => abrirEditar(u)}>
                          ✏️ Editar
                        </button>
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
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
          )}
        </div>
      </main>

      {/* ── Modal crear / editar ── */}
      {showModal && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editando ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
            {error && <div className="message error-message">{error}</div>}

            <div className="form-group">
              <label>Nombre *</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>

            <div className="form-group">
              <label>Correo *</label>
              <input
                type="email"
                value={form.correo}
                onChange={(e) => setForm({ ...form, correo: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div className="form-group">
              <label>Contraseña {editando ? '(vacío = sin cambios)' : '*'}</label>
              <PasswordInput
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value, confirmarPassword: '' })}
                placeholder="Mín. 8 car., mayúscula, número, especial"
              />
              {!editando && (
                <small className="pwd-hint">
                  8+ caracteres · Mayúscula · Minúscula · Número · Especial (!@#$%…)
                </small>
              )}
            </div>

            {/* Confirmación: siempre al crear, al editar solo si hay nueva contraseña */}
            {mostrarConfirmar && (
              <div className="form-group">
                <label>Confirmar Contraseña *</label>
                <PasswordInput
                  value={form.confirmarPassword}
                  onChange={(e) => setForm({ ...form, confirmarPassword: e.target.value })}
                  placeholder="Repite la contraseña"
                />
              </div>
            )}

            <div className="form-group">
              <label>Rol *</label>
              <select
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value })}
              >
                <option>Admin</option>
                <option>Cajero</option>
                <option>Cocinero</option>
                <option>Despachador</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                className="btn"
                style={{
                  flex: 1, background: 'var(--surface)',
                  color: 'var(--text-muted)', border: '1px solid var(--border)',
                }}
                onClick={cerrarModal}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleGuardar}
                disabled={guardando}
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal inactivar ── */}
      {showInactivarModal && (
        <div className="modal-overlay" onClick={() => setShowInactivarModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>🔒 Inactivar Usuario</h3>
            {error && <div className="message error-message">{error}</div>}

            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              ¿Estás seguro de inactivar a <strong style={{ color: 'var(--text)' }}>{inactivarTarget?.nombre}</strong>?
            </p>

            <div className="form-group">
              <label>Motivo / Explicación *</label>
              <textarea
                value={motivoInactivar}
                onChange={(e) => setMotivoInactivar(e.target.value)}
                placeholder="Escribe el motivo por el que se inactiva este usuario..."
                rows={3}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '12px 16px', fontSize: '15px',
                  color: 'var(--text)', fontFamily: 'DM Sans, sans-serif',
                  resize: 'vertical', width: '100%',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                className="btn"
                style={{
                  flex: 1, background: 'var(--surface)',
                  color: 'var(--text-muted)', border: '1px solid var(--border)',
                }}
                onClick={() => setShowInactivarModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn"
                style={{
                  flex: 1, background: 'var(--red-bg)',
                  color: '#e74c3c', border: '1px solid rgba(192,57,43,0.3)',
                }}
                onClick={confirmarInactivar}
              >
                🔒 Inactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Usuarios;