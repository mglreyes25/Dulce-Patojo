import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import Sidebar from '../components/Sidebar';
import Pagination from '../components/Pagination';
import API from '../utils/api';
import { X, Plus, Loader2 } from 'lucide-react';

export default function Inventario() {
  const [inventario, setInventario]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [busqueda, setBusqueda]         = useState('');
  const [filtroStock, setFiltroStock]   = useState('todos');

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [busqueda, filtroStock]);

  const [showModal, setShowModal]         = useState(false);
  const [modalTipo, setModalTipo]         = useState('entrada');
  const [form, setForm]                   = useState({ producto_id: '', cantidad: '', descripcion: '' });
  const [guardando, setGuardando]         = useState(false);

  const [showMovimientos, setShowMovimientos] = useState(null);
  const [movimientos, setMovimientos]         = useState([]);
  const [ajusteModal, setAjusteModal]         = useState(null);
  const [ajusteDesc, setAjusteDesc]           = useState('');

  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  useInactividad();

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (usuario.rol !== 'Admin') { navigate('/dashboard'); return; }
    cargarInventario();
  }, []);

  const cargarInventario = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/inventario`, { headers });
      setInventario(res.data || []);
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) {
        localStorage.clear(); navigate('/login');
      }
      setError('Error al cargar inventario');
    } finally {
      setLoading(false);
    }
  };

  const inventarioFiltrado = inventario.filter(p => {
    const mb = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const ms = filtroStock === 'todos' ||
      (filtroStock === 'bajo' && p.bajo_stock) ||
      (filtroStock === 'sin' && p.sin_stock) ||
      (filtroStock === 'ok' && !p.bajo_stock && !p.sin_stock);
    return mb && ms;
  });

  const totalPages = Math.max(1, Math.ceil(inventarioFiltrado.length / ITEMS_PER_PAGE));
  const paginados = inventarioFiltrado.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const abrirModal = (tipo) => {
    setModalTipo(tipo);
    setForm({ producto_id: '', cantidad: '', descripcion: '' });
    setError('');
    setShowModal(true);
  };

  const handleGuardar = async () => {
    if (!form.producto_id || !form.cantidad || Number(form.cantidad) <= 0) {
      return setError('Selecciona un producto e ingresa una cantidad positiva');
    }

    setGuardando(true);
    try {
      const payload = {
        producto_id: form.producto_id,
        cantidad: Number(form.cantidad),
        descripcion: form.descripcion || undefined,
      };

      if (modalTipo === 'entrada') {
        await axios.post(`${API}/inventario/entrada`, payload, { headers });
      } else {
        await axios.post(`${API}/inventario/salida`, payload, { headers });
      }

      setShowModal(false);
      cargarInventario();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarAjuste = async () => {
    if (!ajusteModal) return;
    try {
      await axios.post(`${API}/inventario/ajuste`, {
        producto_id: ajusteModal.productoId,
        stock_nuevo: Number(ajusteModal.stockNuevo),
        descripcion: ajusteDesc || undefined,
      }, { headers });
      cargarInventario();
      setAjusteModal(null);
      setAjusteDesc('');
    } catch (e) {
      setError(e.response?.data?.error || 'Error al ajustar stock');
    }
  };

  const abrirAjuste = (productoId, stockNuevo) => {
    setAjusteModal({ productoId, stockNuevo });
    setAjusteDesc('');
  };

  const verMovimientos = async (productoId) => {
    setShowMovimientos(productoId);
    try {
      const res = await axios.get(`${API}/inventario/movimientos/${productoId}`, { headers });
      setMovimientos(res.data || []);
    } catch {
      setMovimientos([]);
    }
  };

  const totalProductos = inventario.length;
  const conStock = inventario.filter(p => p.stock > 0).length;
  const bajoStock = inventario.filter(p => p.bajo_stock).length;
  const sinStock = inventario.filter(p => p.sin_stock).length;

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="inventario" />

      <main className="main-content">
        <div className="page-header">
          <div>
            <h2 className="page-title">Inventario</h2>
            <p className="page-subtitle">
              Control de existencias de productos
            </p>
          </div>
          <div className="page-header-actions">
            <button className="btn" style={{ background: 'var(--green-bg)', color: '#2ecc71', border: '1px solid rgba(39,174,96,0.3)' }} onClick={() => abrirModal('entrada')}>
              + Entrada
            </button>
            <button className="btn" style={{ background: 'var(--red-bg)', color: '#e74c3c', border: '1px solid rgba(192,57,43,0.3)' }} onClick={() => abrirModal('salida')}>
              - Salida
            </button>
          </div>
        </div>

        {error && <div className="message error-message">{error}</div>}

        {/* Stats rápidos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <div className="stat-card" style={{ borderColor: 'var(--green)' }}>
            <div className="stat-value" style={{ color: '#2ecc71' }}>{conStock}</div>
            <div className="stat-label">Con Stock</div>
          </div>
          <div className="stat-card" style={{ borderColor: '#f1c40f' }}>
            <div className="stat-value" style={{ color: '#f1c40f' }}>{bajoStock}</div>
            <div className="stat-label">Stock Bajo</div>
          </div>
          <div className="stat-card" style={{ borderColor: 'var(--red)' }}>
            <div className="stat-value" style={{ color: '#e74c3c' }}>{sinStock}</div>
            <div className="stat-label">Sin Stock</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalProductos}</div>
            <div className="stat-label">Total</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="filtros-bar">
          <input
            className="filtro-input"
            placeholder="🔍 Buscar producto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <select className="filtro-select" value={filtroStock} onChange={e => setFiltroStock(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="ok">Con stock</option>
            <option value="bajo">Stock bajo</option>
            <option value="sin">Sin stock</option>
          </select>
          {(busqueda || filtroStock !== 'todos') && (
            <button className="filtro-clear" onClick={() => { setBusqueda(''); setFiltroStock('todos'); }}>
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Tabla */}
        <div className="card">
          {loading ? (
            <p className="loading-text"><Loader2 size={20} className="spin" style={{ verticalAlign: 'middle', marginRight: 8 }} /> Cargando inventario...</p>
          ) : inventarioFiltrado.length === 0 ? (
            <div className="empty-state">
              <p>{inventario.length === 0 ? 'No hay productos registrados' : 'Sin resultados'}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Stock Actual</th>
                    <th>Stock Mínimo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginados.map(p => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.nombre}</strong>
                        {p.descripcion && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {p.descripcion}
                          </div>
                        )}
                      </td>
                      <td><span className="badge badge-primary">{p.categorias?.nombre || '—'}</span></td>
                      <td>
                        <span style={{
                          fontWeight: 700, fontSize: '16px',
                          color: p.sin_stock ? '#e74c3c' : p.bajo_stock ? '#f1c40f' : '#2ecc71'
                        }}>
                          {p.stock}
                        </span>
                      </td>
                      <td>
                        <input
                          type="number" min="0"
                          value={p.stock_minimo || 0}
                          onChange={async (e) => {
                            const val = Number(e.target.value);
                            if (val >= 0) {
                              try {
                                await axios.put(`${API}/inventario/stock-minimo`, {
                                  producto_id: p.id, stock_minimo: val,
                                }, { headers });
                                cargarInventario();
                              } catch {}
                            }
                          }}
                          style={{
                            width: '70px', padding: '4px 8px', borderRadius: '6px',
                            border: '1px solid var(--border)', background: 'var(--surface)',
                            color: 'var(--text)', textAlign: 'center', fontSize: '13px',
                          }}
                        />
                      </td>
                      <td>
                        {p.sin_stock ? (
                          <span className="badge badge-danger">Sin stock</span>
                        ) : p.bajo_stock ? (
                          <span className="badge badge-warning">Stock bajo</span>
                        ) : (
                          <span className="badge badge-success">Disponible</span>
                        )}
                      </td>
                      <td className="td-actions">
                        <button className="btn-small btn-edit" onClick={() => verMovimientos(p.id)}>
                          📋 Mov.
                        </button>
                        <button
                          className="btn-small"
                          style={{ background: 'var(--surface)', color: '#f1c40f', border: '1px solid rgba(241,196,15,0.3)' }}
                          onClick={() => abrirAjuste(p.id, p.stock)}
                        >
                          ✏️ Ajustar
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

      {/* Modal entrada/salida */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{modalTipo === 'entrada' ? '📦 Registrar Entrada' : '📦 Registrar Salida'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            {error && <div className="message error-message">{error}</div>}
            <div className="modal-body">
              <div className="form-group">
                <label>Producto *</label>
                <select value={form.producto_id} onChange={e => setForm({ ...form, producto_id: e.target.value })}>
                  <option value="">Seleccionar producto...</option>
                  {inventario.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — Stock actual: {p.stock}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Cantidad *</label>
                <input
                  type="number" min="1" step="1"
                  value={form.cantidad}
                  onChange={e => setForm({ ...form, cantidad: e.target.value })}
                  placeholder="Ej: 10"
                />
              </div>

              <div className="form-group">
                <label>Descripción (opcional)</label>
                <input
                  value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Motivo o referencia..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn"
                style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGuardar}
                disabled={guardando}
              >
                {guardando ? 'Guardando...' : modalTipo === 'entrada' ? '📦 Registrar Entrada' : '📦 Registrar Salida'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal movimientos */}
      {showMovimientos && (
        <div className="modal-overlay" onClick={() => setShowMovimientos(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📋 Movimientos</h3>
              <button className="modal-close" onClick={() => setShowMovimientos(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {movimientos.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                  Sin movimientos registrados
                </p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Cantidad</th>
                      <th>Stock Anterior</th>
                      <th>Stock Nuevo</th>
                      <th>Descripción</th>
                      <th>Usuario</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map(m => (
                      <tr key={m.id}>
                        <td>
                          <span className={`badge ${m.tipo === 'entrada' ? 'badge-success' : m.tipo === 'salida' ? 'badge-danger' : 'badge-warning'}`}>
                            {m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'salida' ? 'Salida' : 'Ajuste'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}</td>
                        <td>{m.stock_anterior}</td>
                        <td style={{ fontWeight: 600 }}>{m.stock_nuevo}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.descripcion || '—'}</td>
                        <td style={{ fontSize: '12px' }}>{m.usuarios?.nombre || '—'}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {new Date(m.creado_en).toLocaleString('es-GT')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn"
                style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                onClick={() => setShowMovimientos(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajuste de stock */}
      {ajusteModal && (
        <div className="modal-overlay" onClick={() => { setAjusteModal(null); setAjusteDesc(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ Ajustar Stock</h3>
              <button className="modal-close" onClick={() => { setAjusteModal(null); setAjusteDesc(''); }}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nuevo stock</label>
                <input
                  type="number" min="0"
                  value={ajusteModal.stockNuevo}
                  onChange={e => setAjusteModal({ ...ajusteModal, stockNuevo: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Motivo del ajuste</label>
                <input
                  type="text"
                  value={ajusteDesc}
                  onChange={e => setAjusteDesc(e.target.value)}
                  placeholder="Ej: Inventario físico, merma, etc."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn"
                style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                onClick={() => { setAjusteModal(null); setAjusteDesc(''); }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmarAjuste}
              >
                Confirmar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
