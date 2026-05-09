import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';

import Sidebar from '../components/Sidebar';

const API = 'http://localhost:5000';

export default function Productos() {
  const [tab, setTab] = useState('productos');
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroDisponible, setFiltroDisponible] = useState('');

  // Modal producto
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: '', categoria_id: '' });
  const [guardando, setGuardando] = useState(false);

  // Modal combo
  const [showComboModal, setShowComboModal] = useState(false);
  const [editandoCombo, setEditandoCombo] = useState(null);
  const [comboForm, setComboForm] = useState({ nombre: '', descripcion: '', precio: '', items: [] });

  // Modal historial
  const [showHistorial, setShowHistorial] = useState(null);
  const [historial, setHistorial] = useState([]);

  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  useInactividad();

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    cargarTodo();
  }, []);

  const cargarTodo = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, coRes] = await Promise.all([
        axios.get(`${API}/productos`, { headers }),
        axios.get(`${API}/productos/categorias`, { headers }),
        axios.get(`${API}/productos/combos/lista`, { headers }),
      ]);
      setProductos(pRes.data || []);
      setCategorias(cRes.data || []);
      setCombos(coRes.data || []);
    } catch (e) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const productosFiltrados = useMemo(() => {
    return productos.filter(p => {
      const mb = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase());
      const mc = !filtroCategoria || String(p.categoria_id) === filtroCategoria;
      const md = filtroDisponible === '' || String(p.disponible) === filtroDisponible;
      return mb && mc && md;
    });
  }, [productos, busqueda, filtroCategoria, filtroDisponible]);

  const abrirCrear = () => {
    setEditando(null);
    setForm({ nombre: '', descripcion: '', precio: '', categoria_id: categorias[0]?.id || '' });
    setError(''); setShowModal(true);
  };

  const abrirEditar = (p) => {
    setEditando(p);
    setForm({ nombre: p.nombre, descripcion: p.descripcion || '', precio: p.precio, categoria_id: p.categoria_id });
    setError(''); setShowModal(true);
  };

  const guardarProducto = async () => {
    if (!form.nombre || !form.precio || !form.categoria_id)
      return setError('Nombre, precio y categoría son obligatorios');
    if (Number(form.precio) <= 0)
      return setError('El precio debe ser mayor a $0');
    setGuardando(true);
    try {
      if (editando) {
        await axios.put(`${API}/productos/${editando.id}`, { ...form, precio: Number(form.precio) }, { headers });
      } else {
        await axios.post(`${API}/productos`, { ...form, precio: Number(form.precio) }, { headers });
      }
      setShowModal(false); cargarTodo();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const toggleProducto = async (p) => {
    try {
      await axios.patch(`${API}/productos/${p.id}/toggle`, {}, { headers });
      cargarTodo();
    } catch { setError('Error al cambiar disponibilidad'); }
  };

  const verHistorial = async (p) => {
    setShowHistorial(p);
    try {
      const res = await axios.get(`${API}/productos/${p.id}/historial`, { headers });
      setHistorial(res.data || []);
    } catch { setHistorial([]); }
  };

  const abrirCrearCombo = () => {
    setEditandoCombo(null);
    setComboForm({ nombre: '', descripcion: '', precio: '', items: [] });
    setError(''); setShowComboModal(true);
  };

  const agregarItemCombo = (productoId) => {
    const prod = productos.find(p => String(p.id) === String(productoId));
    if (!prod || comboForm.items.find(i => i.producto_id === prod.id)) return;
    setComboForm({ ...comboForm, items: [...comboForm.items, { producto_id: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: 1 }] });
  };

  const quitarItemCombo = (productoId) => {
    setComboForm({ ...comboForm, items: comboForm.items.filter(i => i.producto_id !== productoId) });
  };

  const sumaCombo = comboForm.items.reduce((s, i) => s + (i.precio * i.cantidad), 0);

  const guardarCombo = async () => {
    if (!comboForm.nombre || !comboForm.precio || comboForm.items.length < 2)
      return setError('Nombre, precio y al menos 2 productos son obligatorios');
    if (Number(comboForm.precio) >= sumaCombo)
      return setError(`El precio del combo debe ser menor a $${sumaCombo.toFixed(2)}`);
    setGuardando(true);
    try {
      const payload = {
        nombre: comboForm.nombre, descripcion: comboForm.descripcion,
        precio: Number(comboForm.precio),
        productos: comboForm.items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad }))
      };
      if (editandoCombo) {
        await axios.put(`${API}/productos/combos/${editandoCombo.id}`, payload, { headers });
      } else {
        await axios.post(`${API}/productos/combos`, payload, { headers });
      }
      setShowComboModal(false); cargarTodo();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar combo');
    } finally {
      setGuardando(false);
    }
  };

  const toggleCombo = async (c) => {
    try {
      await axios.patch(`${API}/productos/combos/${c.id}/toggle`, {}, { headers });
      cargarTodo();
    } catch { setError('Error al cambiar estado'); }
  };



  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="productos" />

      <main className="main-content">
        <div className="page-header">
          <div>
            <h2>{tab === 'productos' ? '🍔 Productos' : '🎁 Combos y Promociones'}</h2>
            <p>{tab === 'productos' ? `${productos.length} producto(s) registrado(s)` : `${combos.length} combo(s) registrado(s)`}</p>
          </div>
          {usuario.rol === 'Admin' && (
            <button className="btn btn-primary" onClick={tab === 'productos' ? abrirCrear : abrirCrearCombo}>
              + {tab === 'productos' ? 'Nuevo Producto' : 'Nuevo Combo'}
            </button>
          )}
        </div>

        <div className="tabs-bar">
          <button className={`tab-btn ${tab === 'productos' ? 'active' : ''}`} onClick={() => setTab('productos')}>🍔 Productos</button>
          <button className={`tab-btn ${tab === 'combos' ? 'active' : ''}`} onClick={() => setTab('combos')}>🎁 Combos</button>
        </div>

        {error && !showModal && !showComboModal && <div className="message error-message">{error}</div>}

        {tab === 'productos' && (
          <>
            <div className="filtros-bar">
              <input className="filtro-input" placeholder="🔍 Buscar producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              <select className="filtro-select" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <select className="filtro-select" value={filtroDisponible} onChange={e => setFiltroDisponible(e.target.value)}>
                <option value="">Todos</option>
                <option value="true">Disponible</option>
                <option value="false">No disponible</option>
              </select>
              {(busqueda || filtroCategoria || filtroDisponible !== '') && (
                <button className="filtro-clear" onClick={() => { setBusqueda(''); setFiltroCategoria(''); setFiltroDisponible(''); }}>✕ Limpiar</button>
              )}
            </div>

            <div className="card">
              {loading ? (
                <p className="loading-text">Cargando productos...</p>
              ) : productosFiltrados.length === 0 ? (
                <div className="empty-state">
                  <p>{productos.length === 0 ? 'No hay productos registrados' : 'Sin resultados'}</p>
                  {usuario.rol === 'Admin' && productos.length === 0 && (
                    <button className="btn btn-primary" onClick={abrirCrear}>Crear primer producto</button>
                  )}
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Categoría</th>
                      <th>Precio</th>
                      <th>Estado</th>
                      {usuario.rol === 'Admin' && <th>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {productosFiltrados.map(p => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.nombre}</strong>
                          {p.descripcion && <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px' }}>{p.descripcion}</div>}
                        </td>
                        <td><span className="badge badge-primary">{p.categorias?.nombre || '—'}</span></td>
                        <td><span style={{ color:'var(--gold-light)', fontWeight:600 }}>${Number(p.precio).toFixed(2)}</span></td>
                        <td>
                          <span className={`badge ${p.disponible ? 'badge-success' : 'badge-danger'}`}>
                            {p.disponible ? 'Disponible' : 'No disponible'}
                          </span>
                        </td>
                        {usuario.rol === 'Admin' && (
                          <td>
                            <button className="btn-small btn-edit" onClick={() => abrirEditar(p)}>✏️ Editar</button>
                            <button className={`btn-small ${p.disponible ? 'btn-delete' : 'btn-success'}`} onClick={() => toggleProducto(p)}>
                              {p.disponible ? '🔒 Ocultar' : '✅ Mostrar'}
                            </button>
                            <button className="btn-small" style={{ background:'var(--surface)', color:'var(--text-muted)', border:'1px solid var(--border)' }} onClick={() => verHistorial(p)}>
                              📋 Historial
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab === 'combos' && (
          <div className="combos-grid">
            {loading ? (
              <p className="loading-text">Cargando combos...</p>
            ) : combos.length === 0 ? (
              <div className="empty-state">
                <p>No hay combos registrados</p>
                {usuario.rol === 'Admin' && <button className="btn btn-primary" onClick={abrirCrearCombo}>Crear primer combo</button>}
              </div>
            ) : (
              combos.map(c => (
                <div key={c.id} className={`combo-card ${!c.activo ? 'inactivo' : ''}`}>
                  <div className="combo-header">
                    <span className="combo-tag">🎁 COMBO</span>
                    <span className={`badge ${c.activo ? 'badge-success' : 'badge-danger'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                  </div>
                  <h3 className="combo-nombre">{c.nombre}</h3>
                  {c.descripcion && <p className="combo-desc">{c.descripcion}</p>}
                  <div className="combo-items">
                    {c.items?.map((item, i) => (
                      <span key={i} className="combo-item-tag">{item.cantidad}x {item.productos?.nombre}</span>
                    ))}
                  </div>
                  <div className="combo-footer">
                    <span className="combo-precio">${Number(c.precio).toFixed(2)}</span>
                    {usuario.rol === 'Admin' && (
                      <div style={{ display:'flex', gap:'8px' }}>
                        <button className="btn-small btn-edit" onClick={() => {
                          setEditandoCombo(c);
                          setComboForm({ nombre: c.nombre, descripcion: c.descripcion || '', precio: c.precio, items: c.items?.map(i => ({ producto_id: i.productos?.id, nombre: i.productos?.nombre, precio: i.productos?.precio, cantidad: i.cantidad })) || [] });
                          setError(''); setShowComboModal(true);
                        }}>✏️</button>
                        <button className={`btn-small ${c.activo ? 'btn-delete' : 'btn-success'}`} onClick={() => toggleCombo(c)}>{c.activo ? '🔒' : '✅'}</button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Modal Producto */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editando ? 'Editar Producto' : 'Nuevo Producto'}</h3>
            {error && <div className="message error-message">{error}</div>}
            <div className="form-group">
              <label>Nombre *</label>
              <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} placeholder="Nombre del producto" />
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <input value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} placeholder="Descripción opcional" />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              <div className="form-group">
                <label>Precio ($) *</label>
                <input type="number" step="0.01" min="0.01" value={form.precio} onChange={e => setForm({...form, precio: e.target.value})} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Categoría *</label>
                <select value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value})}>
                  <option value="">Seleccionar...</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:'12px', marginTop:'24px' }}>
              <button className="btn" style={{ flex:1, background:'var(--surface)', color:'var(--text-muted)', border:'1px solid var(--border)' }} onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={guardarProducto} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Combo */}
      {showComboModal && (
        <div className="modal-overlay" onClick={() => setShowComboModal(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h3>{editandoCombo ? 'Editar Combo' : 'Nuevo Combo'}</h3>
            {error && <div className="message error-message">{error}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              <div className="form-group">
                <label>Nombre *</label>
                <input value={comboForm.nombre} onChange={e => setComboForm({...comboForm, nombre: e.target.value})} placeholder="Nombre del combo" />
              </div>
              <div className="form-group">
                <label>Precio del Combo ($) *</label>
                <input type="number" step="0.01" min="0.01" value={comboForm.precio} onChange={e => setComboForm({...comboForm, precio: e.target.value})} placeholder="0.00" />
              </div>
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <input value={comboForm.descripcion} onChange={e => setComboForm({...comboForm, descripcion: e.target.value})} placeholder="Descripción del combo" />
            </div>
            <div className="form-group">
              <label>Agregar Producto al Combo</label>
              <select onChange={e => { if (e.target.value) { agregarItemCombo(e.target.value); e.target.value = ''; } }}>
                <option value="">-- Seleccionar producto --</option>
                {productos.filter(p => p.disponible && !comboForm.items.find(i => i.producto_id === p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} — ${Number(p.precio).toFixed(2)}</option>
                ))}
              </select>
            </div>
            <div className="combo-items-list">
              {comboForm.items.length === 0 ? (
                <p style={{ color:'var(--text-muted)', fontSize:'13px', textAlign:'center', padding:'12px' }}>Agrega al menos 2 productos</p>
              ) : (
                comboForm.items.map(item => (
                  <div key={item.producto_id} className="combo-item-row">
                    <span>{item.nombre}</span>
                    <span style={{ color:'var(--gold-light)' }}>${Number(item.precio).toFixed(2)}</span>
                    <input type="number" min="1" value={item.cantidad}
                      onChange={e => setComboForm({...comboForm, items: comboForm.items.map(i => i.producto_id === item.producto_id ? {...i, cantidad: Number(e.target.value)} : i)})}
                      style={{ width:'60px', padding:'4px 8px', borderRadius:'6px', border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', textAlign:'center' }}
                    />
                    <button className="btn-small btn-delete" onClick={() => quitarItemCombo(item.producto_id)}>✕</button>
                  </div>
                ))
              )}
              {comboForm.items.length > 0 && (
                <div className="combo-suma">
                  <span>Suma de productos: <strong style={{ color:'var(--text-muted)', textDecoration:'line-through' }}>${sumaCombo.toFixed(2)}</strong></span>
                  {comboForm.precio && <span>Precio combo: <strong style={{ color:'var(--gold-light)' }}>${Number(comboForm.precio).toFixed(2)}</strong></span>}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:'12px', marginTop:'24px' }}>
              <button className="btn" style={{ flex:1, background:'var(--surface)', color:'var(--text-muted)', border:'1px solid var(--border)' }} onClick={() => setShowComboModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={guardarCombo} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar Combo'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial */}
      {showHistorial && (
        <div className="modal-overlay" onClick={() => setShowHistorial(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>📋 Historial de Precios — {showHistorial.nombre}</h3>
            {historial.length === 0 ? (
              <p style={{ color:'var(--text-muted)', textAlign:'center', padding:'20px' }}>Sin cambios de precio registrados</p>
            ) : (
              <table className="table">
                <thead><tr><th>Anterior</th><th>Nuevo</th><th>Usuario</th><th>Fecha</th></tr></thead>
                <tbody>
                  {historial.map(h => (
                    <tr key={h.id}>
                      <td style={{ textDecoration:'line-through', color:'var(--text-muted)' }}>${Number(h.precio_anterior).toFixed(2)}</td>
                      <td style={{ color:'var(--gold-light)', fontWeight:600 }}>${Number(h.precio_nuevo).toFixed(2)}</td>
                      <td>{h.usuarios?.nombre || '—'}</td>
                      <td style={{ color:'var(--text-muted)', fontSize:'12px' }}>{new Date(h.creado_en).toLocaleString('es-GT')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button className="btn" style={{ width:'100%', marginTop:'16px', background:'var(--surface)', color:'var(--text-muted)', border:'1px solid var(--border)' }} onClick={() => setShowHistorial(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}