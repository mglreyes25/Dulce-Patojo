import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { X, Tag, Target, Gift, Clock, Power, Edit3, Trash2, Check, Plus } from 'lucide-react';
import { useInactividad } from '../hooks/useInactividad';
import Sidebar from '../components/Sidebar';
import ConfirmModal from '../components/ConfirmModal';
import API from '../utils/api';

const TIPOS = {
  descuento_porcentaje: { label: 'Descuento %',    icon: Tag,   color: '#3498db' },
  dos_x_uno:           { label: '2x1',             icon: Target, color: '#9b59b6' },
  tres_x_dos:          { label: '3x2',             icon: Gift,   color: '#e67e22' },
  happy_hour:          { label: 'Happy Hour',       icon: Clock, color: '#27ae60' },
};

const tipoInfo = (tipo) => TIPOS[tipo] || { label: tipo, icon: Tag, color: '#8a8070' };

function PromoCard({ promo, onToggle, onEditar, onEliminar, esAdmin }) {
  const info = tipoInfo(promo.tipo);
  const activa = promo.activo;
  const IconComponent = info.icon;

  return (
    <div className={`promo-card${!activa ? ' inactive' : ''}`}>
      <div className="promo-card-accent" style={{ background: info.color }} />

      <div className="promo-card-content">
        <div className="promo-card-header">
          <div className="promo-card-header-left">
            <div className="promo-card-icon" style={{ background: info.color + '1a', color: info.color }}>
              <IconComponent size={20} />
            </div>
            <div>
              <span className="promo-card-type" style={{ color: info.color }}>{info.label}</span>
              <p className="promo-card-name">{promo.nombre}</p>
            </div>
          </div>
          <span className={`badge ${activa ? 'badge-success' : 'badge-danger'}`}>
            {activa ? 'Activa' : 'Inactiva'}
          </span>
        </div>

        <div className="promo-card-body">
          {promo.descripcion && (
            <p className="promo-card-desc">{promo.descripcion}</p>
          )}

          <div className="promo-card-info">
            {promo.valor && (
              <div className="promo-card-info-row">
                <span className="promo-card-info-label">Descuento</span>
                <span className="promo-card-info-value promo-card-info-value--discount" style={{ color: info.color }}>
                  {promo.valor}%
                </span>
              </div>
            )}

            {promo.productos && (
              <div className="promo-card-info-row">
                <span className="promo-card-info-label">Producto</span>
                <span className="badge badge-primary">{promo.productos.nombre}</span>
              </div>
            )}
            {promo.categorias && (
              <div className="promo-card-info-row">
                <span className="promo-card-info-label">Categoría</span>
                <span className="badge badge-primary">{promo.categorias.nombre}</span>
              </div>
            )}
            {!promo.productos && !promo.categorias && (
              <div className="promo-card-info-row">
                <span className="promo-card-info-label">Aplica a</span>
                <span className="badge badge-warning">Todos los productos</span>
              </div>
            )}

            {promo.tipo === 'happy_hour' && promo.hora_inicio && (
              <div className="promo-card-info-row">
                <span className="promo-card-info-label">Horario</span>
                <span className="promo-card-info-value">
                  {promo.hora_inicio} — {promo.hora_fin}
                </span>
              </div>
            )}

            <div className="promo-card-info-row">
              <span className="promo-card-info-label">Aplicación</span>
              <span className="promo-card-info-value" style={{ color: promo.automatica ? 'var(--green)' : 'var(--amber)' }}>
                {promo.automatica ? 'Automática' : 'Manual (cajero)'}
              </span>
            </div>
          </div>

          {esAdmin && (
            <div className="promo-card-actions">
              <button className="btn-action btn-action--edit" onClick={() => onEditar(promo)}>
                <Edit3 size={14} /> Editar
              </button>
              <button
                className={`btn-action ${activa ? 'btn-action--delete' : 'btn-action--success'}`}
                onClick={() => onToggle(promo)}
              >
                {activa ? <Power size={14} /> : <Check size={14} />}
                {activa ? 'Desactivar' : 'Activar'}
              </button>
              <button
                className="btn-action btn-action--danger"
                style={{ marginLeft: 'auto' }}
                onClick={() => onEliminar(promo)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Promociones() {
  const [promociones, setPromociones]   = useState([]);
  const [productos, setProductos]       = useState([]);
  const [categorias, setCategorias]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [filtro, setFiltro]             = useState('todos');
  const [busqueda, setBusqueda]         = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editando, setEditando]         = useState(null);
  const [guardando, setGuardando]       = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({
    nombre: '', descripcion: '', tipo: 'descuento_porcentaje',
    valor: '', producto_id: '', categoria_id: '',
    hora_inicio: '', hora_fin: '', automatica: true
  });

  const navigate = useNavigate();
  const token    = localStorage.getItem('token');
  const usuario  = JSON.parse(localStorage.getItem('usuario') || '{}');
  const headers  = { Authorization: `Bearer ${token}` };
  const esAdmin  = usuario.rol === 'Admin';
  useInactividad();

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    cargarTodo();
  }, []);

  const cargarTodo = async () => {
    setLoading(true);
    try {
      const [proRes, prodRes, catRes] = await Promise.all([
        axios.get(`${API}/promociones`, { headers }),
        axios.get(`${API}/productos`, { headers }),
        axios.get(`${API}/productos/categorias`, { headers }),
      ]);
      setPromociones(proRes.data || []);
      setProductos(prodRes.data || []);
      setCategorias(catRes.data || []);
    } catch {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const promocionesFiltradas = useMemo(() => {
    return promociones.filter(p => {
      const mb = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase());
      const mf = filtro === 'todos' || p.tipo === filtro;
      return mb && mf;
    });
  }, [promociones, busqueda, filtro]);

  const abrirCrear = () => {
    setEditando(null);
    setForm({ nombre: '', descripcion: '', tipo: 'descuento_porcentaje', valor: '', producto_id: '', categoria_id: '', hora_inicio: '', hora_fin: '', automatica: true });
    setError('');
    setShowModal(true);
  };

  const abrirEditar = (p) => {
    setEditando(p);
    setForm({
      nombre: p.nombre, descripcion: p.descripcion || '',
      tipo: p.tipo, valor: p.valor || '',
      producto_id: p.producto_id || '',
      categoria_id: p.categoria_id || '',
      hora_inicio: p.hora_inicio || '',
      hora_fin: p.hora_fin || '',
      automatica: p.automatica
    });
    setError('');
    setShowModal(true);
  };

  const guardar = async () => {
    if (!form.nombre) return setError('El nombre es obligatorio');
    if (form.tipo === 'descuento_porcentaje' || form.tipo === 'happy_hour') {
      if (!form.valor || Number(form.valor) <= 0 || Number(form.valor) > 100)
        return setError('El descuento debe ser entre 1% y 100%');
    }
    if (form.tipo === 'happy_hour' && (!form.hora_inicio || !form.hora_fin))
      return setError('Debes indicar hora de inicio y fin');
    if (form.tipo === 'happy_hour' && form.hora_inicio >= form.hora_fin)
      return setError('La hora de inicio debe ser menor a la hora de fin');

    setGuardando(true);
    setError('');
    try {
      const payload = {
        ...form,
        valor: form.valor ? Number(form.valor) : null,
        producto_id: form.producto_id || null,
        categoria_id: form.categoria_id || null,
        hora_inicio: form.hora_inicio || null,
        hora_fin: form.hora_fin || null,
      };
      if (editando) {
        await axios.put(`${API}/promociones/${editando.id}`, payload, { headers });
      } else {
        await axios.post(`${API}/promociones`, payload, { headers });
      }
      setShowModal(false);
      cargarTodo();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleToggle = async (p) => {
    try {
      await axios.patch(`${API}/promociones/${p.id}/toggle`, {}, { headers });
      cargarTodo();
    } catch { setError('Error al cambiar estado'); }
  };

  const confirmEliminar = async () => {
    if (!deleteConfirm) return;
    try {
      await axios.delete(`${API}/promociones/${deleteConfirm.id}`, { headers });
      cargarTodo();
    } catch { setError('Error al eliminar'); }
    setDeleteConfirm(null);
  };

  const activas   = promociones.filter(p => p.activo).length;
  const inactivas = promociones.filter(p => !p.activo).length;

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="promociones" />

      <main className="main-content">
        <div className="page-header">
          <div>
            <h2 className="page-title">Promociones</h2>
            <p className="page-subtitle">{activas} activa(s) · {inactivas} inactiva(s)</p>
          </div>
          <div className="page-header-actions">
            {esAdmin && (
              <button className="btn btn-primary" onClick={abrirCrear}><Plus size={18} /> Nueva Promoción</button>
            )}
          </div>
        </div>

        {/* Stats rápidos */}
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          {Object.entries(TIPOS).map(([key, t]) => {
            const count = promociones.filter(p => p.tipo === key).length;
            const IconComponent = t.icon;
            return (
              <div key={key} className="stat-card">
                <div className="stat-card-icon" style={{ background: t.color + '1a' }}>
                  <IconComponent size={20} style={{ color: t.color }} />
                </div>
                <div className="stat-card-value">{count}</div>
                <div className="stat-card-label">{t.label}</div>
              </div>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="filtros-bar">
          <input
            className="filtro-input"
            placeholder="🔍 Buscar promoción..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <select className="filtro-select" value={filtro} onChange={e => setFiltro(e.target.value)}>
            <option value="todos">Todos los tipos</option>
            {Object.entries(TIPOS).map(([key, t]) => (
              <option key={key} value={key}>{t.label}</option>
            ))}
          </select>
          {(busqueda || filtro !== 'todos') && (
            <button className="filtro-clear" onClick={() => { setBusqueda(''); setFiltro('todos'); }}>✕ Limpiar</button>
          )}
        </div>

        {error && <div className="message error-message">{error}</div>}

        {loading ? (
          <p className="loading-text">Cargando promociones...</p>
        ) : promocionesFiltradas.length === 0 ? (
          <div className="empty-state">
            <p>{promociones.length === 0 ? 'No hay promociones creadas' : 'Sin resultados'}</p>
            {esAdmin && promociones.length === 0 && (
              <button className="btn btn-primary" onClick={abrirCrear}>Crear primera promoción</button>
            )}
          </div>
        ) : (
          <div className="promo-grid">
            {promocionesFiltradas.map(p => (
              <PromoCard
                key={p.id}
                promo={p}
                esAdmin={esAdmin}
                onToggle={handleToggle}
                onEditar={abrirEditar}
                onEliminar={(p) => setDeleteConfirm(p)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal crear / editar promoción */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} role="dialog" aria-modal="true">
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editando ? 'Editar Promoción' : 'Nueva Promoción'}</h3>
              <button className="modal-close-btn" onClick={() => setShowModal(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="message error-message">{error}</div>}

              <div className="form-group">
                <label>Nombre *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre de la promoción" />
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción opcional" />
              </div>

              <div className="form-group">
                <label>Tipo *</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value, valor: '', producto_id: '', categoria_id: '' })}>
                  {Object.entries(TIPOS).map(([key, t]) => (
                    <option key={key} value={key}>{t.label}</option>
                  ))}
                </select>
              </div>

              {(form.tipo === 'descuento_porcentaje' || form.tipo === 'happy_hour') && (
                <div className="form-group">
                  <label>Valor del descuento (%) *</label>
                  <input type="number" min="1" max="100" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="Ej: 15" />
                </div>
              )}

              <div className="form-group">
                <label>Aplicar a producto específico (opcional)</label>
                <select value={form.producto_id} onChange={e => setForm({ ...form, producto_id: e.target.value, categoria_id: '' })}>
                  <option value="">Todos los productos</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>O a categoría específica (opcional)</label>
                <select value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value, producto_id: '' })}>
                  <option value="">Todas las categorías</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              {form.tipo === 'happy_hour' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Hora inicio *</label>
                    <input type="time" value={form.hora_inicio} onChange={e => setForm({ ...form, hora_inicio: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Hora fin *</label>
                    <input type="time" value={form.hora_fin} onChange={e => setForm({ ...form, hora_fin: e.target.value })} />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.automatica} onChange={e => setForm({ ...form, automatica: e.target.checked })} />
                  Aplicación automática
                </label>
                <small style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                  Si se activa, la promoción se aplicará automáticamente en la caja.
                </small>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando...' : editando ? 'Actualizar Promoción' : 'Crear Promoción'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteConfirm}
        title="Eliminar promoción"
        message={`¿Eliminar la promoción "${deleteConfirm?.nombre}"?`}
        confirmText="Eliminar"
        danger
        onConfirm={confirmEliminar}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
