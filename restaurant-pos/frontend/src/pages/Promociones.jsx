import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import Sidebar from '../components/Sidebar';

const API = 'http://localhost:5000';

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

  const handleEliminar = async (p) => {
    if (!window.confirm(`¿Eliminar la promoción "${p.nombre}"?`)) return;
    try {
      await axios.delete(`${API}/promociones/${p.id}`, { headers });
      cargarTodo();
    } catch { setError('Error al eliminar'); }
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
                onEliminar={handleEliminar}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{editando ? '✏️ Editar Promoción' : '➕ Nueva Promoción'}</h3>

            {error && <div className="message error-message">{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Nombre *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Happy Hour viernes" />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Descripción</label>
                <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción opcional" />
              </div>

              <div className="form-group">
                <label>Tipo de Promoción *</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value, valor: '', hora_inicio: '', hora_fin: '' })}>
                  {Object.entries(TIPOS).map(([key, t]) => (
                    <option key={key} value={key}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Aplicación</label>
                <select value={form.automatica ? 'auto' : 'manual'} onChange={e => setForm({ ...form, automatica: e.target.value === 'auto' })}>
                  <option value="auto">⚡ Automática (si califica)</option>
                  <option value="manual">👆 Manual (cajero la aplica)</option>
                </select>
              </div>

              {/* Descuento % */}
              {(form.tipo === 'descuento_porcentaje' || form.tipo === 'happy_hour') && (
                <div className="form-group">
                  <label>Descuento (%) *</label>
                  <input
                    type="number" min="1" max="100" step="1"
                    value={form.valor}
                    onChange={e => setForm({ ...form, valor: e.target.value })}
                    placeholder="Ej: 20"
                  />
                </div>
              )}

              {/* Horario happy hour */}
              {form.tipo === 'happy_hour' && (
                <>
                  <div className="form-group">
                    <label>Hora Inicio *</label>
                    <input type="time" value={form.hora_inicio} onChange={e => setForm({ ...form, hora_inicio: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Hora Fin *</label>
                    <input type="time" value={form.hora_fin} onChange={e => setForm({ ...form, hora_fin: e.target.value })} />
                  </div>
                </>
              )}

              {/* Aplica a producto o categoría */}
              {form.tipo !== 'dos_x_uno' && form.tipo !== 'tres_x_dos' && (
                <>
                  <div className="form-group">
                    <label>Aplica a Producto (opcional)</label>
                    <select value={form.producto_id} onChange={e => setForm({ ...form, producto_id: e.target.value, categoria_id: '' })}>
                      <option value="">Todos los productos</option>
                      {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  {!form.producto_id && (
                    <div className="form-group">
                      <label>O Aplica a Categoría (opcional)</label>
                      <select value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value })}>
                        <option value="">Todas las categorías</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* 2x1 y 3x2 aplican a un producto específico */}
              {(form.tipo === 'dos_x_uno' || form.tipo === 'tres_x_dos') && (
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Producto al que aplica (opcional)</label>
                  <select value={form.producto_id} onChange={e => setForm({ ...form, producto_id: e.target.value })}>
                    <option value="">Todos los productos</option>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} — ${Number(p.precio).toFixed(2)}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Preview */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginTop: '16px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 6px' }}>Vista previa:</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>{tipoInfo(form.tipo).icon}</span>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: tipoInfo(form.tipo).color, textTransform: 'uppercase' }}>
                    {tipoInfo(form.tipo).label}
                  </span>
                  {form.valor && <span style={{ fontSize: '13px', color: 'var(--text)', marginLeft: '8px' }}>— {form.valor}% OFF</span>}
                  {form.tipo === 'dos_x_uno' && <span style={{ fontSize: '13px', color: 'var(--text)', marginLeft: '8px' }}>— Lleva 2, paga 1</span>}
                  {form.tipo === 'tres_x_dos' && <span style={{ fontSize: '13px', color: 'var(--text)', marginLeft: '8px' }}>— Lleva 3, paga 2</span>}
                  {form.tipo === 'happy_hour' && form.hora_inicio && (
                    <span style={{ fontSize: '13px', color: 'var(--text)', marginLeft: '8px' }}>— {form.hora_inicio} a {form.hora_fin}</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                className="btn"
                style={{ flex: 1, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                onClick={() => setShowModal(false)}
              >Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar Promoción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
