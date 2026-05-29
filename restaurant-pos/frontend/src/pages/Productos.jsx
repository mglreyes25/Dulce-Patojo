import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { X, Pencil, Lock, Check, History, Undo2, Trash2 } from 'lucide-react';
import { useInactividad } from '../hooks/useInactividad';
import Sidebar from '../components/Sidebar';
import Pagination from '../components/Pagination';
import API from '../utils/api';
import ActionButton from '../components/ActionButton';

/* ─────────────────────────────────────────────────────────────────
   Helper: sube el archivo al backend y devuelve la URL pública
───────────────────────────────────────────────────────────────── */
const subirImagen = async (file, headers) => {
  const fd = new FormData();
  fd.append('imagen', file);
  const res = await axios.post(`${API}/productos/upload-imagen`, fd, {
    headers: { ...headers, 'Content-Type': 'multipart/form-data' },
  });
  return res.data.url;
};

/* ─────────────────────────────────────────────────────────────────
   Componente reutilizable: selector de imagen con preview
───────────────────────────────────────────────────────────────── */
function ImagenPicker({ valor, onChange }) {
  const ref = useRef();
  const [preview, setPreview] = useState(valor || null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result);
      onChange(file, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const quitar = () => {
    setPreview(null);
    onChange(null, null);
    if (ref.current) ref.current.value = '';
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{
        display: 'block', marginBottom: '6px',
        fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)'
      }}>
        Imagen (opcional)
      </label>

      <div
        onClick={() => ref.current.click()}
        style={{
          border: '2px dashed var(--border)',
          borderRadius: '10px',
          height: preview ? 'auto' : '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          overflow: 'hidden',
          background: 'var(--surface)',
          transition: 'border-color .2s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold-light)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        {preview ? (
          <img
            src={preview}
            alt="preview"
            style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            📷 Haz clic para seleccionar imagen
          </span>
        )}
      </div>

      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {preview && (
        <button
          onClick={quitar}
          style={{
            marginTop: '6px', background: 'none', border: 'none',
            color: 'var(--danger)', cursor: 'pointer', fontSize: '12px'
          }}
        >
          ✕ Quitar imagen
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Página principal de Productos
───────────────────────────────────────────────────────────────── */
export default function Productos() {
  const [tab, setTab]               = useState('productos');
  const [productos, setProductos]   = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [combos, setCombos]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // Filtros
  const [busqueda, setBusqueda]               = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroDisponible, setFiltroDisponible] = useState('');

  // Paginación
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [busqueda, filtroCategoria, filtroDisponible]);

  // Modal producto
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando]   = useState(null);
  const [form, setForm]           = useState({ nombre: '', descripcion: '', precio: '', categoria_id: '' });
  const [imagenFile, setImagenFile]       = useState(null);
  const [imagenPreview, setImagenPreview] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Modal combo
  const [showComboModal, setShowComboModal]   = useState(false);
  const [editandoCombo, setEditandoCombo]     = useState(null);
  const [comboForm, setComboForm]             = useState({ nombre: '', descripcion: '', precio: '', items: [] });
  const [comboImagenFile, setComboImagenFile]       = useState(null);
  const [comboImagenPreview, setComboImagenPreview] = useState(null);

  // Modal historial
  const [showHistorial, setShowHistorial] = useState(null);
  const [historial, setHistorial]         = useState([]);

  // Modal eliminar producto
  const [showEliminarModal, setShowEliminarModal] = useState(false);
  const [eliminarTarget, setEliminarTarget]       = useState(null);
  const [eliminando, setEliminando]               = useState(false);

  // Modal precios masivos
  const [showPreciosModal, setShowPreciosModal] = useState(false);
  const [preciosForm, setPreciosForm] = useState({ categoria_id: '', tipo: 'porcentaje', valor: '' });
  const [preciosMensaje, setPreciosMensaje] = useState('');
  const [aplicandoPrecios, setAplicandoPrecios] = useState(false);


  const navigate = useNavigate();
  const usuario  = JSON.parse(localStorage.getItem('usuario') || '{}');
  const token    = localStorage.getItem('token');
  const headers  = { Authorization: `Bearer ${token}` };
  useInactividad();

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    cargarTodo();
  }, []);

  /* ── Carga de datos ── */
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

  const totalPages = Math.max(1, Math.ceil(productosFiltrados.length / ITEMS_PER_PAGE));
  const paginados = productosFiltrados.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  /* ── Acciones Producto ── */
  const abrirCrear = () => {
    setEditando(null);
    setForm({ nombre: '', descripcion: '', precio: '', categoria_id: categorias[0]?.id || '' });
    setImagenFile(null); setImagenPreview(null);
    setError(''); setShowModal(true);
  };

  const abrirEditar = (p) => {
    setEditando(p);
    setForm({ nombre: p.nombre, descripcion: p.descripcion || '', precio: p.precio, categoria_id: p.categoria_id });
    setImagenFile(null); setImagenPreview(p.imagen_url || null);
    setError(''); setShowModal(true);
  };

  const guardarProducto = async () => {
    if (!form.nombre || !form.precio || !form.categoria_id)
      return setError('Nombre, precio y categoría son obligatorios');
    if (Number(form.precio) <= 0)
      return setError('El precio debe ser mayor a $0');

    setGuardando(true);
    try {
      // Determinar URL de imagen
      let imagen_url = editando?.imagen_url || null;
      if (imagenPreview === null) imagen_url = null;          // usuario quitó imagen
      if (imagenFile)  imagen_url = await subirImagen(imagenFile, headers); // nueva imagen

      const payload = { ...form, precio: Number(form.precio), imagen_url };

      if (editando) {
        await axios.put(`${API}/productos/${editando.id}`, payload, { headers });
      } else {
        await axios.post(`${API}/productos`, payload, { headers });
      }
      setShowModal(false);
      cargarTodo();
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

  const handleEliminarProducto = async () => {
    setEliminando(true);
    try {
      await axios.delete(`${API}/productos/${eliminarTarget.id}`, { headers });
      setShowEliminarModal(false);
      setEliminarTarget(null);
      cargarTodo();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar producto');
      setShowEliminarModal(false);
    } finally {
      setEliminando(false);
    }
  };

  const verHistorial = async (p) => {
    setShowHistorial(p);
    try {
      const res = await axios.get(`${API}/productos/${p.id}/historial`, { headers });
      setHistorial(res.data || []);
    } catch { setHistorial([]); }
  };

  /* ── Precios masivos ── */
  const abrirPreciosMasivos = () => {
    setPreciosForm({ categoria_id: '', tipo: 'porcentaje', valor: '' });
    setPreciosMensaje('');
    setError('');
    setShowPreciosModal(true);
  };

  const aplicarPreciosMasivos = async () => {
    if (!preciosForm.categoria_id || !preciosForm.valor)
      return setError('Selecciona una categoría e ingresa un valor');
    if (Number(preciosForm.valor) === 0)
      return setError('El valor no puede ser 0');
    if (preciosForm.tipo === 'fijo' && Number(preciosForm.valor) <= 0)
      return setError('El precio fijo debe ser mayor a $0');

    setAplicandoPrecios(true);
    setError('');
    try {
      const payload = { categoria_id: preciosForm.categoria_id };
      if (preciosForm.tipo === 'porcentaje') {
        payload.porcentaje = Number(preciosForm.valor);
      } else {
        payload.precio_fijo = Number(preciosForm.valor);
      }
      const res = await axios.post(`${API}/productos/precios/masivo`, payload, { headers });
      setPreciosMensaje(res.data.message);
      cargarTodo();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al actualizar precios');
    } finally {
      setAplicandoPrecios(false);
    }
  };

  const revertirPrecio = async (producto) => {
    try {
      const res = await axios.post(`${API}/productos/${producto.id}/revertir-precio`, {}, { headers });
      alert(res.data.message);
      verHistorial(producto);
      cargarTodo();
    } catch (e) {
      alert(e.response?.data?.error || 'No hay cambio de precio para revertir');
    }
  };


  /* ── Acciones Combo ── */
  const abrirCrearCombo = () => {
    setEditandoCombo(null);
    setComboForm({ nombre: '', descripcion: '', precio: '', items: [] });
    setComboImagenFile(null); setComboImagenPreview(null);
    setError(''); setShowComboModal(true);
  };

  const agregarItemCombo = (productoId) => {
    const prod = productos.find(p => String(p.id) === String(productoId));
    if (!prod || comboForm.items.find(i => i.producto_id === prod.id)) return;
    setComboForm({
      ...comboForm,
      items: [...comboForm.items, { producto_id: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: 1 }]
    });
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
      let imagen_url = editandoCombo?.imagen_url || null;
      if (comboImagenPreview === null) imagen_url = null;
      if (comboImagenFile) imagen_url = await subirImagen(comboImagenFile, headers);

      const payload = {
        nombre: comboForm.nombre,
        descripcion: comboForm.descripcion,
        precio: Number(comboForm.precio),
        imagen_url,
        productos: comboForm.items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad }))
      };

      if (editandoCombo) {
        await axios.put(`${API}/productos/combos/${editandoCombo.id}`, payload, { headers });
      } else {
        await axios.post(`${API}/productos/combos`, payload, { headers });
      }
      setShowComboModal(false);
      cargarTodo();
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

  /* ── Render ── */
  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="productos" />

      <main className="main-content">
        <div className="page-header">
          <div>
            <h2 className="page-title">{tab === 'productos' ? 'Productos' : 'Combos y Promociones'}</h2>
            <p className="page-subtitle">
              {tab === 'productos'
                ? `${productos.length} producto(s) registrado(s)`
                : `${combos.length} combo(s) registrado(s)`}
            </p>
          </div>
          <div className="page-header-actions">
            {usuario.rol === 'Admin' && tab === 'productos' && (
              <button className="btn btn-secondary" onClick={abrirPreciosMasivos}>
                Gestión de Precios
              </button>
            )}
            {usuario.rol === 'Admin' && (
              <button className="btn btn-primary" onClick={tab === 'productos' ? abrirCrear : abrirCrearCombo}>
                + {tab === 'productos' ? 'Nuevo Producto' : 'Nuevo Combo'}
              </button>
            )}
          </div>
        </div>

        <div className="tabs-bar">
          <button className={`tab-btn ${tab === 'productos' ? 'active' : ''}`} onClick={() => setTab('productos')}>Productos</button>
          <button className={`tab-btn ${tab === 'combos'   ? 'active' : ''}`} onClick={() => setTab('combos')}>Combos</button>
        </div>

        {error && !showModal && !showComboModal && (
          <div className="message error-message">{error}</div>
        )}

        {/* ════════════ TAB PRODUCTOS ════════════ */}
        {tab === 'productos' && (
          <>
            <div className="filtros-bar">
              <input
                className="filtro-input"
                placeholder="Buscar producto..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
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
                <button className="filtro-clear" onClick={() => { setBusqueda(''); setFiltroCategoria(''); setFiltroDisponible(''); }}>
                  ✕ Limpiar
                </button>
              )}
            </div>

            <div className="card">
              {loading ? (
                <div className="skeleton-card" style={{padding:16, border:'none'}}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)'}}>
                      <span className="skeleton" style={{width:52, height:52, borderRadius:8, flexShrink:0}}>&nbsp;</span>
                      <div style={{flex:1, display:'flex', flexDirection:'column', gap:6}}>
                        <span className="skeleton skeleton-line skeleton-line--md">&nbsp;</span>
                        <span className="skeleton skeleton-line skeleton-line--sm">&nbsp;</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : productosFiltrados.length === 0 ? (
                <div className="empty-state">
                  <p>{productos.length === 0 ? 'No hay productos registrados' : 'Sin resultados'}</p>
                  {usuario.rol === 'Admin' && productos.length === 0 && (
                    <button className="btn btn-primary" onClick={abrirCrear}>Crear primer producto</button>
                  )}
                </div>
              ) : (
                <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Imagen</th>
                      <th>Nombre</th>
                      <th>Categoría</th>
                      <th>Precio</th>
                      <th>Estado</th>
                      {usuario.rol === 'Admin' && <th>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginados.map(p => (
                      <tr key={p.id}>
                        <td>
                          {p.imagen_url ? (
                            <img
                              src={p.imagen_url}
                              alt={p.nombre}
                              style={{
                                width: '52px', height: '52px',
                                objectFit: 'cover', borderRadius: '8px',
                                border: '1px solid var(--border)'
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '52px', height: '52px', borderRadius: '8px',
                              background: 'var(--surface)', border: '1px solid var(--border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '22px'
                            }}>🍔</div>
                          )}
                        </td>
                        <td>
                          <strong>{p.nombre}</strong>
                          {p.descripcion && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {p.descripcion}
                            </div>
                          )}
                        </td>
                        <td><span className="badge badge-primary">{p.categorias?.nombre || '—'}</span></td>
                        <td><span style={{ color: 'var(--gold-light)', fontWeight: 600 }}>${Number(p.precio).toFixed(2)}</span></td>
                        <td>
                          <span className={`badge ${p.disponible ? 'badge-success' : 'badge-danger'}`}>
                            {p.disponible ? 'Disponible' : 'No disponible'}
                          </span>
                        </td>
                        {usuario.rol === 'Admin' && (
                          <td className="td-actions">
                            <ActionButton icon={Pencil} variant="edit" label="Editar" onClick={() => abrirEditar(p)} />
                            <ActionButton
                              icon={p.disponible ? Lock : Check}
                              variant={p.disponible ? 'delete' : 'success'}
                              label={p.disponible ? 'Ocultar' : 'Mostrar'}
                              onClick={() => toggleProducto(p)}
                            />
                            <ActionButton icon={History} variant="secondary" label="Historial" onClick={() => verHistorial(p)} />
                            <ActionButton icon={Undo2} variant="warning" label="Revertir" onClick={() => revertirPrecio(p)} />
                            <ActionButton icon={Trash2} variant="danger" label="Eliminar" onClick={() => { setEliminarTarget(p); setShowEliminarModal(true); }} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </>
              )}
            </div>
          </>
        )}

        {/* ════════════ TAB COMBOS ════════════ */}
        {tab === 'combos' && (
          <div className="combos-grid">
            {loading ? (
              <div className="skeleton-grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))'}}>
                {[1,2,3].map(i => (
                  <div key={i} className="skeleton-card">
                    <span className="skeleton skeleton-line skeleton-line--title">&nbsp;</span>
                    <span className="skeleton skeleton-line skeleton-line--md">&nbsp;</span>
                    <span className="skeleton skeleton-line skeleton-line--sm">&nbsp;</span>
                    <div style={{display:'flex', justifyContent:'space-between', marginTop:8}}>
                      <span className="skeleton" style={{width:80, height:24, borderRadius:6}}>&nbsp;</span>
                      <span className="skeleton" style={{width:60, height:24, borderRadius:6}}>&nbsp;</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : combos.length === 0 ? (
              <div className="empty-state">
                <p>No hay combos registrados</p>
                {usuario.rol === 'Admin' && (
                  <button className="btn btn-primary" onClick={abrirCrearCombo}>Crear primer combo</button>
                )}
              </div>
            ) : (
              combos.map(c => (
                <div key={c.id} className={`combo-card ${!c.activo ? 'inactivo' : ''}`}>
                  {/* Imagen del combo */}
                  {c.imagen_url && (
                    <div style={{
                      margin: '-1px -1px 0', overflow: 'hidden',
                      borderRadius: '12px 12px 0 0', height: '140px'
                    }}>
                      <img
                        src={c.imagen_url}
                        alt={c.nombre}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  )}

                  <div className="combo-header" style={{ marginTop: c.imagen_url ? '12px' : 0 }}>
                    <span className="combo-tag">🎁 COMBO</span>
                    <span className={`badge ${c.activo ? 'badge-success' : 'badge-danger'}`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <h3 className="combo-nombre">{c.nombre}</h3>
                  {c.descripcion && <p className="combo-desc">{c.descripcion}</p>}

                  <div className="combo-items">
                    {c.items?.map((item, i) => (
                      <span key={i} className="combo-item-tag">
                        {item.cantidad}x {item.productos?.nombre}
                      </span>
                    ))}
                  </div>

                  <div className="combo-footer">
                    <span className="combo-precio">${Number(c.precio).toFixed(2)}</span>
                    {usuario.rol === 'Admin' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn-small btn-edit"
                          onClick={() => {
                            setEditandoCombo(c);
                            setComboForm({
                              nombre: c.nombre,
                              descripcion: c.descripcion || '',
                              precio: c.precio,
                              items: c.items?.map(i => ({
                                producto_id: i.productos?.id,
                                nombre: i.productos?.nombre,
                                precio: i.productos?.precio,
                                cantidad: i.cantidad
                              })) || []
                            });
                            setComboImagenFile(null);
                            setComboImagenPreview(c.imagen_url || null);
                            setError('');
                            setShowComboModal(true);
                          }}
                        >✏️</button>
                        <button
                          className={`btn-small ${c.activo ? 'btn-delete' : 'btn-success'}`}
                          onClick={() => toggleCombo(c)}
                        >
                          {c.activo ? '🔒' : '✅'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* ════════════ MODAL PRODUCTO ════════════ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} role="dialog" aria-modal="true">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editando ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button className="modal-close-btn" onClick={() => setShowModal(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="message error-message">{error}</div>}

              <ImagenPicker
                valor={imagenPreview}
                onChange={(file, preview) => { setImagenFile(file); setImagenPreview(preview); }}
              />

              <div className="form-group">
                <label>Nombre *</label>
                <input
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre del producto"
                />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <input
                  value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Descripción opcional"
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Precio ($) *</label>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={form.precio}
                    onChange={e => setForm({ ...form, precio: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Categoría *</label>
                  <select value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarProducto} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ MODAL COMBO ════════════ */}
      {showComboModal && (
        <div className="modal-overlay" onClick={() => setShowComboModal(false)}>
          <div
            className="modal modal-wide modal-combo"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-title">
                {editandoCombo ? 'Editar Combo' : 'Nuevo Combo'}
              </span>
              <button className="modal-close-btn" onClick={() => setShowComboModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="message error-message" style={{ marginBottom: '20px' }}>
                  {error}
                </div>
              )}

              <ImagenPicker
                valor={comboImagenPreview}
                onChange={(file, preview) => { setComboImagenFile(file); setComboImagenPreview(preview); }}
              />

              <div className="combo-section">
                <div className="modal-section-title">Información del Combo</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Nombre *</label>
                    <input
                      value={comboForm.nombre}
                      onChange={e => setComboForm({ ...comboForm, nombre: e.target.value })}
                      placeholder="Nombre del combo"
                    />
                  </div>
                  <div className="form-group">
                    <label>Precio del Combo ($) *</label>
                    <input
                      type="number" step="0.01" min="0.01"
                      value={comboForm.precio}
                      onChange={e => setComboForm({ ...comboForm, precio: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label>Descripción</label>
                  <input
                    value={comboForm.descripcion}
                    onChange={e => setComboForm({ ...comboForm, descripcion: e.target.value })}
                    placeholder="Descripción del combo"
                  />
                </div>
              </div>

              <div className="combo-section">
                <div className="modal-section-title">Productos del Combo</div>
                <div className="form-group">
                  <label>Agregar Producto</label>
                  <select onChange={e => { if (e.target.value) { agregarItemCombo(e.target.value); e.target.value = ''; } }}>
                    <option value="">-- Seleccionar producto --</option>
                    {productos
                      .filter(p => p.disponible && !comboForm.items.find(i => i.producto_id === p.id))
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} — ${Number(p.precio).toFixed(2)}</option>
                      ))}
                  </select>
                </div>

                <div className="combo-items-list">
                  {comboForm.items.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                      Agrega al menos 2 productos al combo
                    </p>
                  ) : (
                    comboForm.items.map(item => (
                      <div key={item.producto_id} className="combo-item-row">
                        <span>{item.nombre}</span>
                        <span style={{ color: 'var(--gold-light)' }}>${Number(item.precio).toFixed(2)}</span>
                        <input
                          type="number" min="1" value={item.cantidad}
                          onChange={e => setComboForm({
                            ...comboForm,
                            items: comboForm.items.map(i =>
                              i.producto_id === item.producto_id ? { ...i, cantidad: Number(e.target.value) } : i
                            )
                          })}
                          style={{
                            width: '60px', padding: '4px 8px', borderRadius: '6px',
                            border: '1px solid var(--border)', background: 'var(--surface)',
                            color: 'var(--text)', textAlign: 'center'
                          }}
                          title="Cantidad"
                        />
                        <button className="btn-small btn-delete" onClick={() => quitarItemCombo(item.producto_id)}>✕</button>
                      </div>
                    ))
                  )}
                  {comboForm.items.length > 0 && (
                    <div className="combo-suma">
                      <span>
                        Suma de productos:{' '}
                        <strong style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                          ${sumaCombo.toFixed(2)}
                        </strong>
                      </span>
                      {comboForm.precio && (
                        <span>
                          Precio combo:{' '}
                          <strong style={{ color: 'var(--gold-light)' }}>
                            ${Number(comboForm.precio).toFixed(2)}
                          </strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn"
                style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                onClick={() => setShowComboModal(false)}
              >Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={guardarCombo}
                disabled={guardando}
              >
                {guardando ? 'Guardando...' : 'Guardar Combo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ MODAL HISTORIAL ════════════ */}
      {/* ════════════ MODAL PRECIOS MASIVOS ════════════ */}
      {showPreciosModal && (
        <div className="modal-overlay" onClick={() => setShowPreciosModal(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h3>💲 Gestión de Precios</h3>

            {error && <div className="message error-message">{error}</div>}
            {preciosMensaje && <div className="message success-message">✅ {preciosMensaje}</div>}

            <div className="form-group">
              <label>Categoría *</label>
              <select value={preciosForm.categoria_id} onChange={e => setPreciosForm({ ...preciosForm, categoria_id: e.target.value })}>
                <option value="">Seleccionar categoría...</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Tipo de Cambio</label>
              <select value={preciosForm.tipo} onChange={e => setPreciosForm({ ...preciosForm, tipo: e.target.value, valor: '' })}>
                <option value="porcentaje">Porcentaje (% aumento o descuento)</option>
                <option value="fijo">Precio fijo para todos los productos</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                {preciosForm.tipo === 'porcentaje'
                  ? 'Porcentaje (usa negativo para descuento, ej: -10 = -10%)'
                  : 'Nuevo Precio Fijo ($)'}
              </label>
              <input
                type="number"
                step={preciosForm.tipo === 'porcentaje' ? '1' : '0.01'}
                value={preciosForm.valor}
                onChange={e => setPreciosForm({ ...preciosForm, valor: e.target.value })}
                placeholder={preciosForm.tipo === 'porcentaje' ? 'Ej: 10 o -5' : 'Ej: 5.99'}
              />
              {preciosForm.tipo === 'porcentaje' && preciosForm.valor && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {Number(preciosForm.valor) > 0
                    ? `↑ Aumento del ${preciosForm.valor}%`
                    : `↓ Descuento del ${Math.abs(preciosForm.valor)}%`}
                </p>
              )}
            </div>

            {preciosForm.categoria_id && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  Productos en esta categoría: <strong style={{ color: 'var(--text)' }}>
                    {productos.filter(p => String(p.categoria_id) === preciosForm.categoria_id).length}
                  </strong>
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                className="btn"
                style={{ flex: 1, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                onClick={() => setShowPreciosModal(false)}
              >Cerrar</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={aplicarPreciosMasivos}
                disabled={aplicandoPrecios}
              >
                {aplicandoPrecios ? 'Aplicando...' : '💲 Aplicar Cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal eliminar producto ── */}
      {showEliminarModal && (
        <div className="modal-overlay" onClick={() => setShowEliminarModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#e74c3c' }}>🗑️ Eliminar Producto</h3>

            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              ¿Estás seguro de eliminar permanentemente <strong style={{ color: 'var(--text)' }}>{eliminarTarget?.nombre}</strong>?
            </p>
            <p style={{ fontSize: '13px', color: '#e74c3c', background: 'var(--red-bg)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px' }}>
              ⚠️ Esta acción no se puede deshacer. Si el producto está en pedidos, combos o recetas, no se podrá eliminar.
            </p>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                className="btn"
                style={{ flex: 1, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                onClick={() => setShowEliminarModal(false)}
              >Cancelar</button>
              <button
                className="btn"
                style={{ flex: 1, background: '#c0392b', color: '#fff', border: '1px solid #e74c3c' }}
                onClick={handleEliminarProducto}
                disabled={eliminando}
              >
                {eliminando ? 'Eliminando…' : '🗑️ Eliminar Permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistorial && (
        <div className="modal-overlay" onClick={() => setShowHistorial(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>📋 Historial de Precios — {showHistorial.nombre}</h3>
            {historial.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                Sin cambios de precio registrados
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Anterior</th><th>Nuevo</th><th>Usuario</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {historial.map(h => (
                    <tr key={h.id}>
                      <td style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                        ${Number(h.precio_anterior).toFixed(2)}
                      </td>
                      <td style={{ color: 'var(--gold-light)', fontWeight: 600 }}>
                        ${Number(h.precio_nuevo).toFixed(2)}
                      </td>
                      <td>{h.usuarios?.nombre || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {new Date(h.creado_en).toLocaleString('es-GT')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button
              className="btn"
              style={{ width: '100%', marginTop: '16px', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              onClick={() => setShowHistorial(null)}
            >Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}