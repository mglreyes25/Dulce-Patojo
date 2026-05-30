import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import Sidebar from '../components/Sidebar';
import { useToast } from '../context/ToastContext';
import { X, Plus } from 'lucide-react';
import API from '../utils/api';

function Recetas() {
  const [productos, setProductos]       = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [recetas, setRecetas]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [editItems, setEditItems]       = useState([]);
  const [guardando, setGuardando]       = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  useInactividad();

  const cargar = async () => {
    try {
      const [prodRes, ingRes, recRes] = await Promise.all([
        axios.get(`${API}/productos`, { headers }),
        axios.get(`${API}/ingredientes`, { headers }),
        axios.get(`${API}/recetas`, { headers }),
      ]);
      setProductos(prodRes.data || []);
      setIngredientes(ingRes.data || []);
      setRecetas(recRes.data || []);
    } catch {
      addToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (usuario.rol !== 'Admin') { navigate('/dashboard'); return; }
    cargar();
  }, []);

  const seleccionarProducto = (producto) => {
    setSelectedProducto(producto);
    const existentes = recetas.filter(r => r.producto_id === producto.id);
    setEditItems(existentes.map(r => ({
      ingrediente_id: r.ingrediente_id,
      cantidad: Number(r.cantidad),
    })));
  };

  const agregarItem = () => {
    if (ingredientes.length === 0) return;
    const firstAvail = ingredientes.find(i => !editItems.some(e => e.ingrediente_id === i.id));
    setEditItems([...editItems, {
      ingrediente_id: firstAvail?.id || ingredientes[0].id,
      cantidad: 1,
    }]);
  };

  const updateItem = (idx, field, value) => {
    const nuevo = [...editItems];
    nuevo[idx] = { ...nuevo[idx], [field]: value };
    setEditItems(nuevo);
  };

  const removeItem = (idx) => {
    setEditItems(editItems.filter((_, i) => i !== idx));
  };

  const guardar = async () => {
    if (!selectedProducto || editItems.length === 0) {
      addToast('Selecciona un producto y al menos un ingrediente', 'warning');
      return;
    }
    setGuardando(true);
    try {
      await axios.post(`${API}/recetas`, {
        producto_id: selectedProducto.id,
        items: editItems,
      }, { headers });
      addToast('Receta guardada', 'success');
      await cargar();
      setSelectedProducto(null);
      setEditItems([]);
    } catch {
      addToast('Error al guardar receta', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const productosConReceta = recetas.reduce((acc, r) => {
    acc.add(r.producto_id);
    return acc;
  }, new Set());

  if (!usuario) return null;

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="recetas" />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h2 className="page-title">Recetas</h2>
            <p className="page-subtitle">
              Asigna ingredientes a cada producto
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-text">Cargando...</div>
        ) : (
          <div className="recetas-grid">
            {/* Lista de productos */}
            <div>
              <h3 className="recetas-section-title">Productos</h3>
              <div className="recetas-product-list">
                {productos.filter(p => p.activo !== false).map(p => {
                  const tiene = productosConReceta.has(p.id);
                  return (
                    <button key={p.id} onClick={() => seleccionarProducto(p)}
                      className={`recetas-product-btn${selectedProducto?.id === p.id ? ' active' : ''}`}>
                      <span>{p.nombre}</span>
                      {tiene && <span className="badge badge-success recetas-badge">Receta</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editor de receta */}
            <div>
              {selectedProducto ? (
                <div className="card">
                  <h3 style={{ marginBottom: 8 }}>{selectedProducto.nombre}</h3>
                  <p className="recetas-hint">Define los ingredientes y cantidades para este producto</p>

                  {editItems.map((item, idx) => {
                    const ing = ingredientes.find(i => i.id === item.ingrediente_id);
                    return (
                      <div key={idx} className="recetas-item-row">
                        <select className="form-select" value={item.ingrediente_id}
                          onChange={e => updateItem(idx, 'ingrediente_id', Number(e.target.value))}>
                          {ingredientes.map(i => (
                            <option key={i.id} value={i.id} disabled={editItems.some((e, ei) => ei !== idx && e.ingrediente_id === i.id)}>
                              {i.nombre} ({i.unidad})
                            </option>
                          ))}
                        </select>
                        <input className="form-input recetas-cantidad-input" type="number" step="0.001" min="0" value={item.cantidad}
                          onChange={e => updateItem(idx, 'cantidad', e.target.value)} />
                        <span className="recetas-unidad">{ing?.unidad || ''}</span>
                        <button className="btn-small btn-delete" onClick={() => removeItem(idx)}>✕</button>
                      </div>
                    );
                  })}

                  <div className="recetas-actions">
                    <button className="btn btn-secondary" onClick={agregarItem}>
                      + Agregar Ingrediente
                    </button>
                    <button className="btn btn-primary" onClick={guardar} disabled={guardando || editItems.length === 0}>
                      {guardando ? 'Guardando...' : 'Guardar Receta'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <p>Selecciona un producto para editar su receta</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Recetas;
