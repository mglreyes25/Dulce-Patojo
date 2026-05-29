import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { X, Pencil, Lock, Check, Trash2 } from 'lucide-react';
import { useInactividad } from '../hooks/useInactividad';
import useSocket from '../hooks/useSocket';
import { API_URL } from '../utils/api';
import Sidebar from '../components/Sidebar';
import Pagination from '../components/Pagination';
import PasswordInput from '../components/PasswordInput';
import ActionButton from '../components/ActionButton';
import { validarPassword } from '../utils/password';
import { useToast } from '../context/ToastContext';

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

  // Eliminar modal (dos pasos)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmarModal, setShowConfirmarModal] = useState(false);
  const [confirmarInput, setConfirmarInput]       = useState('');
  const [eliminarTarget, setEliminarTarget]       = useState(null);
  const [eliminando, setEliminando]               = useState(false);

  // Estado en línea (socket)
  const [onlineIds, setOnlineIds]       = useState([]);
  const { socket: socketRef } = useSocket();

  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    const handler = (ids) => setOnlineIds(ids);
    s.on('usuarios-online', handler);
    return () => s.off('usuarios-online', handler);
  }, [socketRef]);

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
  const { addToast } = useToast();

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
        (filtroEstado === 'Inactivo' && !u.activo) ||
        (filtroEstado === 'Online' && onlineIds.includes(u.id)) ||
        (filtroEstado === 'Offline' && !onlineIds.includes(u.id));
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

  const handleEliminar = async () => {
    setEliminando(true);
    try {
      await axios.delete(`${API_URL}/usuarios/${eliminarTarget.id}`, { headers });
      addToast('Usuario eliminado permanentemente', 'success');
      setShowConfirmarModal(false);
      setEliminarTarget(null);
      cargarUsuarios();
    } catch (err) {
      addToast(err.response?.data?.error || 'Error al eliminar usuario', 'error');
      setShowConfirmarModal(false);
    } finally {
      setEliminando(false);
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
            <h2 className="page-title">Gestión de Usuarios</h2>
            <p className="page-subtitle">
              Administra los accesos al sistema · {usuarios.length} usuario(s) registrado(s)
            </p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-primary" onClick={abrirCrear}>
              + Nuevo Usuario
            </button>
          </div>
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
            <option value="Online">En línea</option>
            <option value="Offline">Desconectado</option>
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
                    <th>En línea</th>
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
                      <td>
                        <span
                          className={`socket-indicator ${onlineIds.includes(u.id) ? 'connected' : 'disconnected'}`}
                          title={onlineIds.includes(u.id) ? 'En línea' : 'Desconectado'}
                        />
                      </td>
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
                        <ActionButton icon={Pencil} variant="edit" label="Editar" onClick={() => abrirEditar(u)} />
                        <ActionButton
                          icon={u.activo ? Lock : Check}
                          variant={u.activo ? 'delete' : 'success'}
                          label={u.activo ? 'Inactivar' : 'Activar'}
                          onClick={() => handleToggle(u)}
                        />
                        <ActionButton icon={Trash2} variant="danger" label="Eliminar" onClick={() => { setEliminarTarget(u); setShowConfirmDelete(true); }} />
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
        <div className="modal-overlay" onClick={cerrarModal} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editando ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button className="modal-close-btn" onClick={cerrarModal} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
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
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Primer paso: confirmar eliminación ── */}
      {showConfirmDelete && (
        <div className="modal-overlay" onClick={() => setShowConfirmDelete(false)} role="dialog" aria-modal="true">
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Eliminar Usuario</h3>
              <button className="modal-close-btn" onClick={() => setShowConfirmDelete(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                ¿Estás seguro de eliminar permanentemente a <strong style={{ color: 'var(--text)' }}>{eliminarTarget?.nombre}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowConfirmDelete(false)}>Cancelar</button>
              <button
                className="btn btn-danger"
                onClick={() => { setShowConfirmDelete(false); setShowConfirmarModal(true); setConfirmarInput(''); }}
              >
                Sí, estoy seguro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Segundo paso: escribir "confirmar" ── */}
      {showConfirmarModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmarModal(false)} role="dialog" aria-modal="true">
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Confirmar eliminación</h3>
              <button className="modal-close-btn" onClick={() => setShowConfirmarModal(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="message error-message">{error}</div>}
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Para confirmar, escribe <strong style={{ color: 'var(--text)' }}>confirmar</strong> en el campo de abajo.
              </p>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <input
                  type="text"
                  className="form-input"
                  value={confirmarInput}
                  onChange={(e) => setConfirmarInput(e.target.value)}
                  placeholder="Escribe 'confirmar'"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && confirmarInput === 'confirmar' && !eliminando) handleEliminar(); }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowConfirmarModal(false)}>Cancelar</button>
              <button
                className="btn btn-danger"
                disabled={confirmarInput !== 'confirmar' || eliminando}
                onClick={handleEliminar}
              >
                {eliminando ? 'Eliminando…' : 'Eliminar Permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal inactivar ── */}
      {showInactivarModal && (
        <div className="modal-overlay" onClick={() => setShowInactivarModal(false)} role="dialog" aria-modal="true">
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Inactivar Usuario</h3>
              <button className="modal-close-btn" onClick={() => setShowInactivarModal(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="message error-message">{error}</div>}
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                ¿Estás seguro de inactivar a <strong style={{ color: 'var(--text)' }}>{inactivarTarget?.nombre}</strong>?
              </p>
              <div className="form-group">
                <label>Motivo / Explicación *</label>
                <textarea
                  className="form-input"
                  value={motivoInactivar}
                  onChange={(e) => setMotivoInactivar(e.target.value)}
                  placeholder="Escribe el motivo por el que se inactiva este usuario..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowInactivarModal(false)}>Cancelar</button>
              <button className="btn btn-warning" onClick={confirmarInactivar}>Inactivar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Usuarios;