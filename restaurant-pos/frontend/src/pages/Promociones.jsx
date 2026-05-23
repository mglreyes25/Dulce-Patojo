import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import Sidebar from '../components/Sidebar';
import ConfirmModal from '../components/ConfirmModal';
import API from '../utils/api';

const TIPOS = {
  descuento_porcentaje: { label: 'Descuento %',    icon: '🏷️', color: '#3498db', bg: 'rgba(52,152,219,0.15)' },
  dos_x_uno:           { label: '2x1',             icon: '🎯', color: '#9b59b6', bg: 'rgba(155,89,182,0.15)' },
  tres_x_dos:          { label: '3x2',             icon: '🎁', color: '#e67e22', bg: 'rgba(230,126,34,0.15)'  },
  happy_hour:          { label: 'Happy Hour',       icon: '⏰', color: '#27ae60', bg: 'rgba(39,174,96,0.15)'  },
};

const tipoInfo = (tipo) => TIPOS[tipo] || { label: tipo, icon: '🏷️', color: '#8a8070', bg: 'var(--surface)' };

function PromoCard({ promo, onToggle, onEditar, onEliminar, esAdmin }) {
  const info = tipoInfo(promo.tipo);
  const activa = promo.activo;

  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${activa ? info.color + '44' : 'var(--border)'}`,
      borderRadius: '12px',
      overflow: 'hidden',
      opacity: activa ? 1 : 0.6,
      transition: 'border-color .2s',
    }}>
      {/* Header de color */}
      <div style={{ background: info.bg, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>{info.icon}</span>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: info.color, textTransform: 'uppercase', letterSpacing: '1px' }}>
              {info.label}
            </span>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{promo.nombre}</p>
          </div>
        </div>
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
          background: activa ? 'rgba(39,174,96,0.2)' : 'rgba(192,57,43,0.2)',
          color: activa ? '#2ecc71' : '#e74c3c'
        }}>
          {activa ? 'Activa' : 'Inactiva'}
        </span>
      </div>

      {/* Cuerpo */}
      <div style={{ padding: '14px 18px' }}>
        {promo.descripcion && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.4 }}>
            {promo.descripcion}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          {/* Descuento */}
          {promo.valor && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '80px' }}>Descuento</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: info.color }}>{promo.valor}%</span>
            </div>
          )}

          {/* Aplica a */}
          {promo.productos && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '80px' }}>Producto</span>
              <span className="badge badge-primary">{promo.productos.nombre}</span>
            </div>
          )}
          {promo.categorias && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '80px' }}>Categoría</span>
              <span className="badge badge-primary">{promo.categorias.nombre}</span>
            </div>
          )}
          {!promo.productos && !promo.categorias && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '80px' }}>Aplica a</span>
              <span className="badge badge-warning">Todos los productos</span>
            </div>
          )}

          {/* Horario happy hour */}
          {promo.tipo === 'happy_hour' && promo.hora_inicio && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '80px' }}>Horario</span>
              <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>
                {promo.hora_inicio} — {promo.hora_fin}
              </span>
            </div>
          )}

          {/* Aplicación */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '80px' }}>Aplicación</span>
            <span style={{ fontSize: '12px', color: promo.automatica ? '#2ecc71' : '#f1c40f', fontWeight: 600 }}>
              {promo.automatica ? '⚡ Automática' : '👆 Manual (cajero)'}
            </span>
          </div>
        </div>

        {/* Acciones */}
        {esAdmin && (
          <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <button className="btn-small btn-edit" onClick={() => onEditar(promo)}>✏️ Editar</button>
            <button
              className={`btn-small ${activa ? 'btn-delete' : 'btn-success'}`}
              onClick={() => onToggle(promo)}
            >
              {activa ? '🔒 Desactivar' : '✅ Activar'}
            </button>
            <button
              className="btn-small"
              style={{ background: 'var(--red-bg)', color: '#e74c3c', border: '1px solid rgba(192,57,43,0.3)', marginLeft: 'auto' }}
              onClick={() => onEliminar(promo)}
            >
              🗑️
            </button>
          </div>
        )}
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
            <h2>🏷️ Promociones</h2>
            <p>{activas} activa(s) · {inactivas} inactiva(s)</p>
          </div>
          {esAdmin && (
            <button className="btn btn-primary" onClick={abrirCrear}>+ Nueva Promoción</button>
          )}
        </div>

        {/* Stats rápidos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {Object.entries(TIPOS).map(([key, t]) => {
            const count = promociones.filter(p => p.tipo === key).length;
            return (
              <div key={key} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>{t.icon}</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: t.color, fontFamily: 'Playfair Display, serif' }}>{count}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{t.label}</div>
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
              <option key={key} value={key}>{t.icon} {t.label}</option>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{editando ? 'Editar Promoción' : 'Nueva Promoción'}</h3>

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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn" style={{ flex: 1, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={guardar} disabled={guardando}>
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
