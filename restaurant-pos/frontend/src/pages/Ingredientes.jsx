import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import Sidebar from '../components/Sidebar';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import API from '../utils/api';

function Ingredientes() {
  const [ingredientes, setIngredientes] = useState([]);
  const [proveedores, setProveedores]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [busqueda, setBusqueda]         = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editando, setEditando]         = useState(null);
  const [guardando, setGuardando]       = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [ajusteModal, setAjusteModal]   = useState(null);
  const [showMovimientos, setShowMovimientos] = useState(null);
  const [movimientos, setMovimientos]   = useState([]);
  const [form, setForm] = useState({
    nombre: '', unidad: 'unidad', stock: 0, stock_minimo: 0, precio_compra: 0, proveedor_id: '',
  });

  const navigate = useNavigate();
  const { addToast } = useToast();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  useInactividad();

  const cargar = async () => {
    try {
      const [ingRes, provRes] = await Promise.all([
        axios.get(`${API}/ingredientes`, { headers }),
        axios.get(`${API}/proveedores`, { headers }).catch(() => ({ data: [] })),
      ]);
      setIngredientes(ingRes.data || []);
      setProveedores(provRes.data || []);
    } catch {
      addToast('Error al cargar ingredientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (usuario.rol !== 'Admin') { navigate('/dashboard'); return; }
    cargar();
  }, []);

  const handleGuardar = async () => {
    if (!form.nombre) { addToast('El nombre es requerido', 'error'); return; }
    setGuardando(true);
    try {
      if (editando) {
        await axios.put(`${API}/ingredientes/${editando.id}`, form, { headers });
        addToast('Ingrediente actualizado', 'success');
      } else {
        await axios.post(`${API}/ingredientes`, form, { headers });
        addToast('Ingrediente creado', 'success');
      }
      setShowModal(false);
      setEditando(null);
      resetForm();
      cargar();
    } catch {
      addToast('Error al guardar', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const confirmEliminar = async () => {
    if (!deleteConfirm) return;
    try {
      await axios.delete(`${API}/ingredientes/${deleteConfirm.id}`, { headers });
      addToast('Ingrediente eliminado', 'success');
      cargar();
    } catch {
      addToast('Error al eliminar', 'error');
    }
    setDeleteConfirm(null);
  };

  const abrirEditar = (ing) => {
    setForm({
      nombre: ing.nombre, unidad: ing.unidad, stock: ing.stock,
      stock_minimo: ing.stock_minimo, precio_compra: ing.precio_compra,
      proveedor_id: ing.proveedor_id || '',
    });
    setEditando(ing);
    setShowModal(true);
  };

  const resetForm = () => {
    setForm({ nombre: '', unidad: 'unidad', stock: 0, stock_minimo: 0, precio_compra: 0, proveedor_id: '' });
  };

  const verMovimientos = async (id) => {
    setShowMovimientos(id);
    try {
      const res = await axios.get(`${API}/ingredientes/${id}/movimientos`, { headers });
      setMovimientos(res.data || []);
    } catch {
      setMovimientos([]);
    }
  };

  const filtrados = ingredientes.filter(i =>
    !busqueda || i.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const bajosStock = ingredientes.filter(i => i.stock_minimo > 0 && Number(i.stock) <= Number(i.stock_minimo));

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="ingredientes" />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h2>🥗 Ingredientes</h2>
            <p>{ingredientes.length} registro(s) — {bajosStock.length} con stock bajo</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditando(null); resetForm(); setShowModal(true); }}>
            + Nuevo Ingrediente
          </button>
        </div>

        {bajosStock.length > 0 && (
          <div style={{
            background: 'rgba(241,196,15,0.1)', border: '1px solid rgba(241,196,15,0.3)',
            borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#f1c40f',
          }}>
            ⚠️ {bajosStock.length} ingrediente(s) con stock por debajo del mínimo
          </div>
        )}

        <div className="filtros-bar">
          <input className="filtro-input" placeholder="Buscar ingrediente..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)} />
        </div>

        {loading ? (
          <div className="loading-text">Cargando...</div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Unidad</th>
                  <th>Stock</th>
                  <th>Stock Mínimo</th>
                  <th>Precio Compra</th>
                  <th>Proveedor</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(i => {
                  const bajo = i.stock_minimo > 0 && Number(i.stock) <= Number(i.stock_minimo);
                  return (
                    <tr key={i.id}>
                      <td style={{ fontWeight: 600 }}>{i.nombre}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i.unidad}</td>
                      <td>
                        <span style={{
                          color: bajo ? '#e74c3c' : Number(i.stock) <= 0 ? '#e74c3c' : 'var(--text)',
                          fontWeight: bajo ? 700 : 400,
                        }}>
                          {Number(i.stock).toFixed(2)}
                        </span>
                        {bajo && <span className="badge badge-danger" style={{ marginLeft: 8 }}>Mínimo</span>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Number(i.stock_minimo).toFixed(2)}</td>
                      <td>${Number(i.precio_compra).toFixed(2)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i.proveedores?.nombre || '—'}</td>
                      <td className="td-actions">
                        <button className="btn-small btn-edit" onClick={() => abrirEditar(i)}>✏️</button>
                        <button className="btn-small" style={{ background: 'var(--surface)', color: '#f1c40f', border: '1px solid rgba(241,196,15,0.3)' }}
                          onClick={() => setAjusteModal({ id: i.id, nombre: i.nombre, stock: i.stock })}>📦</button>
                        <button className="btn-small" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                          onClick={() => verMovimientos(i.id)}>📋</button>
                        <button className="btn-small btn-delete" onClick={() => setDeleteConfirm(i)}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal crear/editar */}
        {showModal && (
          <div className="modal-overlay" onClick={() => { setShowModal(false); setEditando(null); }}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>{editando ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}</h3>
              <div className="form-group">
                <label>Nombre</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Harina de trigo" />
              </div>
              <div className="form-group">
                <label>Unidad de medida</label>
                <select value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })}>
                  <option value="unidad">Unidad</option>
                  <option value="kg">Kilogramo (kg)</option>
                  <option value="g">Gramo (g)</option>
                  <option value="l">Litro (l)</option>
                  <option value="ml">Mililitro (ml)</option>
                  <option value="pieza">Pieza</option>
                  <option value="lb">Libra (lb)</option>
                  <option value="oz">Onza (oz)</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Stock actual</label>
                  <input type="number" step="0.001" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Stock mínimo</label>
                  <input type="number" step="0.001" value={form.stock_minimo} onChange={e => setForm({ ...form, stock_minimo: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Precio de compra ($)</label>
                <input type="number" step="0.01" value={form.precio_compra} onChange={e => setForm({ ...form, precio_compra: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Proveedor</label>
                <select value={form.proveedor_id} onChange={e => setForm({ ...form, proveedor_id: e.target.value })}>
                  <option value="">Sin proveedor</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button className="btn" style={{ flex: 1, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  onClick={() => { setShowModal(false); setEditando(null); }}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleGuardar} disabled={guardando}>
                  {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal ajuste stock */}
        {ajusteModal && (
          <div className="modal-overlay" onClick={() => setAjusteModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>📦 Ajustar Stock: {ajusteModal.nombre}</h3>
              <div className="form-group">
                <label>Nuevo stock</label>
                <input type="number" step="0.001" value={ajusteModal.stock}
                  onChange={e => setAjusteModal({ ...ajusteModal, stock: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button className="btn" style={{ flex: 1, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  onClick={() => setAjusteModal(null)}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1 }}
                  onClick={async () => {
                    try {
                      await axios.patch(`${API}/ingredientes/${ajusteModal.id}/stock`,
                        { stock: Number(ajusteModal.stock), descripcion: 'Ajuste manual' }, { headers });
                      addToast('Stock actualizado', 'success');
                      setAjusteModal(null);
                      cargar();
                    } catch { addToast('Error al ajustar stock', 'error'); }
                  }}>Confirmar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal movimientos */}
        {showMovimientos && (
          <div className="modal-overlay" onClick={() => setShowMovimientos(null)}>
            <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
              <h3>📋 Movimientos</h3>
              {movimientos.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Sin movimientos</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Cantidad</th>
                      <th>Stock Ant.</th>
                      <th>Stock Nuevo</th>
                      <th>Descripción</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map(m => (
                      <tr key={m.id}>
                        <td><span className={`badge ${m.tipo === 'entrada' ? 'badge-success' : m.tipo === 'salida' ? 'badge-danger' : 'badge-warning'}`}>{m.tipo}</span></td>
                        <td style={{ fontWeight: 600 }}>{m.cantidad}</td>
                        <td>{m.stock_anterior}</td>
                        <td>{m.stock_nuevo}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.descripcion || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(m.creado_en).toLocaleString('es-GT')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button className="btn" style={{ width: '100%', marginTop: 16, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                onClick={() => setShowMovimientos(null)}>Cerrar</button>
            </div>
          </div>
        )}

        <ConfirmModal
          open={!!deleteConfirm}
          title="Eliminar ingrediente"
          message={`¿Eliminar "${deleteConfirm?.nombre}"?`}
          confirmText="Eliminar" danger
          onConfirm={confirmEliminar}
          onCancel={() => setDeleteConfirm(null)}
        />
      </main>
    </div>
  );
}

export default Ingredientes;
