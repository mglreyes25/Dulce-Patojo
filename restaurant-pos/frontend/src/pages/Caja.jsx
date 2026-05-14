import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import Sidebar from '../components/Sidebar';

const API = 'http://localhost:5000';

/* Estilo reutilizable para botones +/- del carrito */
const btnCantidad = {
  width: '24px', height: '24px', borderRadius: '5px',
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', cursor: 'pointer', fontSize: '15px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1, padding: 0,
};

const TIPOS_PROMO = {
  descuento_porcentaje: { label: 'Descuento %',    icon: '🏷️', color: '#3498db', bg: 'rgba(52,152,219,0.15)' },
  dos_x_uno:           { label: '2x1',             icon: '🎯', color: '#9b59b6', bg: 'rgba(155,89,182,0.15)' },
  tres_x_dos:          { label: '3x2',             icon: '🎁', color: '#e67e22', bg: 'rgba(230,126,34,0.15)'  },
  happy_hour:          { label: 'Happy Hour',       icon: '⏰', color: '#27ae60', bg: 'rgba(39,174,96,0.15)'  },
};

export default function Caja() {
  const [tab, setTab]             = useState('productos');
  const [productos, setProductos] = useState([]);
  const [combos, setCombos]       = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [promociones, setPromociones] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [busqueda, setBusqueda]   = useState('');
  const [loading, setLoading]     = useState(true);
  const [carrito, setCarrito]     = useState([]);

  const navigate = useNavigate();
  const usuario  = JSON.parse(localStorage.getItem('usuario') || '{}');
  const token    = localStorage.getItem('token');
  const headers  = { Authorization: `Bearer ${token}` };
  useInactividad();

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    cargarDatos();

    // Auto-refresh cada 30 segundos para actualización automática del catálogo
    const interval = setInterval(() => {
      cargarDatos();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, catRes, promRes] = await Promise.all([
        axios.get(`${API}/productos?disponible=true`, { headers }),
        axios.get(`${API}/productos/combos/lista`, { headers }),
        axios.get(`${API}/productos/categorias`, { headers }),
        axios.get(`${API}/promociones/activas`, { headers }),
      ]);
      setProductos(pRes.data || []);
      setCombos((cRes.data || []).filter(c => c.activo));
      setCategorias(catRes.data || []);
      setPromociones(promRes.data || []);
    } catch (e) {
      console.error('Error cargando datos de caja:', e);
    } finally {
      setLoading(false);
    }
  };

  /* ── Lógica del carrito ── */
  const agregarAlCarrito = (item, tipo) => {
    const key = `${tipo}-${item.id}`;
    const existe = carrito.find(c => c.key === key);
    if (existe) {
      setCarrito(carrito.map(c => c.key === key ? { ...c, cantidad: c.cantidad + 1 } : c));
    } else {
      setCarrito([...carrito, {
        key, tipo, id: item.id,
        nombre: item.nombre,
        precio: Number(item.precio),
        imagen_url: item.imagen_url || null,
        cantidad: 1,
      }]);
    }
  };

  const cambiarCantidad = (key, delta) => {
    setCarrito(prev =>
      prev
        .map(c => c.key === key ? { ...c, cantidad: c.cantidad + delta } : c)
        .filter(c => c.cantidad > 0)
    );
  };

  const quitarDelCarrito = (key) => setCarrito(carrito.filter(c => c.key !== key));
  const limpiarCarrito   = () => { setCarrito([]); setPromocionesAplicadas([]); };

  /* ── Promociones ── */
  const [promocionesAplicadas, setPromocionesAplicadas] = useState([]);

  const calcularDescuento = (promo, items) => {
    if (promo.tipo === 'descuento_porcentaje' || promo.tipo === 'happy_hour') {
      const itemsAplicables = items.filter(c => {
        if (c.tipo !== 'producto') return false;
        if (promo.producto_id) return Number(c.id) === Number(promo.producto_id);
        if (promo.categoria_id) {
          const prod = productos.find(p => Number(p.id) === Number(c.id));
          return prod && Number(prod.categoria_id) === Number(promo.categoria_id);
        }
        return true;
      });
      const subtotal = itemsAplicables.reduce((s, c) => s + c.precio * c.cantidad, 0);
      return subtotal * (Number(promo.valor) / 100);
    }
    if (promo.tipo === 'dos_x_uno') {
      const itemsAplicables = items.filter(c => {
        if (c.tipo !== 'producto') return false;
        if (promo.producto_id) return Number(c.id) === Number(promo.producto_id);
        return true;
      });
      let desc = 0;
      itemsAplicables.forEach(c => {
        const gratis = Math.floor(c.cantidad / 2);
        desc += gratis * c.precio;
      });
      return desc;
    }
    if (promo.tipo === 'tres_x_dos') {
      const itemsAplicables = items.filter(c => {
        if (c.tipo !== 'producto') return false;
        if (promo.producto_id) return Number(c.id) === Number(promo.producto_id);
        return true;
      });
      let desc = 0;
      itemsAplicables.forEach(c => {
        const gratis = Math.floor(c.cantidad / 3);
        desc += gratis * c.precio;
      });
      return desc;
    }
    return 0;
  };

  const agregarPromocionAlCarrito = (promo) => {
    if (promocionesAplicadas.find(p => p.id === promo.id)) return;
    setPromocionesAplicadas([...promocionesAplicadas, promo]);
  };

  const quitarPromocion = (promoId) => {
    setPromocionesAplicadas(promocionesAplicadas.filter(p => p.id !== promoId));
  };

  const promocionesFiltradas = promociones.filter(p =>
    !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const itemsSinPromo = carrito.filter(c => c.tipo !== 'promocion');
  const subtotal = itemsSinPromo.reduce((s, c) => s + c.precio * c.cantidad, 0);
  const descuentoTotal = promocionesAplicadas.reduce((s, p) => s + calcularDescuento(p, itemsSinPromo), 0);
  const total = Math.max(0, subtotal - descuentoTotal);

  /* ── Filtros ── */
  const productosFiltrados = productos.filter(p => {
    const mb = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const mc = !filtroCategoria || String(p.categoria_id) === filtroCategoria;
    return mb && mc;
  });

  const combosFiltrados = combos.filter(c =>
    !busqueda || c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  /* ── Tarjeta de producto / combo ── */
  const Tarjeta = ({ item, tipo }) => (
    <div
      onClick={() => agregarAlCarrito(item, tipo)}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform  = 'translateY(-2px)';
        e.currentTarget.style.boxShadow  = '0 6px 20px rgba(0,0,0,.25)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform  = 'none';
        e.currentTarget.style.boxShadow  = 'none';
      }}
    >
      {/* Imagen */}
      <div style={{ height: '120px', background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
        {item.imagen_url ? (
          <img
            src={item.imagen_url}
            alt={item.nombre}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', fontSize: '42px'
          }}>
            {tipo === 'combo' ? '🎁' : '🍔'}
          </div>
        )}
        {tipo === 'combo' && (
          <span style={{
            position: 'absolute', top: '8px', left: '8px',
            background: 'var(--gold-light)', color: '#000',
            fontSize: '10px', fontWeight: 700,
            padding: '2px 8px', borderRadius: '20px', letterSpacing: '.5px'
          }}>COMBO</span>
        )}
      </div>

      {/* Información */}
      <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <p style={{
          margin: 0, fontWeight: 600, fontSize: '13px',
          color: 'var(--text)', lineHeight: 1.3
        }}>{item.nombre}</p>

        {item.descripcion && (
          <p style={{
            margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>{item.descripcion}</p>
        )}

        <p style={{ margin: 'auto 0 0', fontSize: '15px', fontWeight: 700, color: 'var(--gold-light)' }}>
          ${Number(item.precio).toFixed(2)}
        </p>
      </div>
    </div>
  );

  /* ── Render ── */
  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="caja" />

      <main className="main-content" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div className="page-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0 }}>🧾 Punto de Venta</h2>
            <p style={{ margin: 0 }}>Selecciona los productos para agregar al pedido</p>
          </div>
          <input
            placeholder="🔍 Buscar..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{
              padding: '8px 14px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text)', fontSize: '14px', width: '220px'
            }}
          />
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ════════════ Panel izquierdo: menú ════════════ */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>

            {/* Tabs y filtro categoría */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              {['productos', 'combos', 'promociones'].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '6px 18px', borderRadius: '20px', border: 'none',
                    cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                    background: tab === t ? 'var(--gold-light)' : 'var(--surface)',
                    color:      tab === t ? '#000'              : 'var(--text-muted)',
                    transition: 'background .2s, color .2s',
                  }}
                >
                  {t === 'productos' ? '🍔 Productos' : t === 'combos' ? '🎁 Combos' : '🏷️ Promociones'}
                </button>
              ))}

              {tab === 'productos' && categorias.length > 0 && (
                <select
                  value={filtroCategoria}
                  onChange={e => setFiltroCategoria(e.target.value)}
                  style={{
                    marginLeft: 'auto', padding: '6px 12px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--text)', fontSize: '13px'
                  }}
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              )}
            </div>

            {/* Grid de tarjetas */}
            {loading ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>
                Cargando menú...
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '12px'
              }}>
                {tab === 'productos'
                  ? productosFiltrados.map(p => <Tarjeta key={p.id} item={p} tipo="producto" />)
                  : tab === 'combos'
                  ? combosFiltrados.map(c => <Tarjeta key={c.id} item={c} tipo="combo" />)
                  : promocionesFiltradas.map(promo => (
                      <div
                        key={promo.id}
                        onClick={() => agregarPromocionAlCarrito(promo)}
                        style={{
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'transform .15s, box-shadow .15s',
                          opacity: promocionesAplicadas.find(p => p.id === promo.id) ? 0.5 : 1,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform  = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow  = '0 6px 20px rgba(0,0,0,.25)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform  = 'none';
                          e.currentTarget.style.boxShadow  = 'none';
                        }}
                      >
                        <div style={{
                          padding: '16px', textAlign: 'center',
                          background: (TIPOS_PROMO[promo.tipo]?.bg || 'var(--surface)'),
                        }}>
                          <span style={{ fontSize: '32px' }}>{TIPOS_PROMO[promo.tipo]?.icon || '🏷️'}</span>
                        </div>
                        <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <p style={{
                            margin: 0, fontWeight: 600, fontSize: '13px',
                            color: 'var(--text)', lineHeight: 1.3
                          }}>{promo.nombre}</p>
                          {promo.descripcion && (
                            <p style={{
                              margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3,
                              display: '-webkit-box', WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical', overflow: 'hidden'
                            }}>{promo.descripcion}</p>
                          )}
                          <p style={{ margin: 'auto 0 0', fontSize: '13px', fontWeight: 700, color: TIPOS_PROMO[promo.tipo]?.color || 'var(--gold-light)' }}>
                            {promo.tipo === 'descuento_porcentaje' || promo.tipo === 'happy_hour' ? `${promo.valor}% OFF` : ''}
                            {promo.tipo === 'dos_x_uno' ? '2x1' : ''}
                            {promo.tipo === 'tres_x_dos' ? '3x2' : ''}
                          </p>
                          {promocionesAplicadas.find(p => p.id === promo.id) && (
                            <span style={{ fontSize: '10px', color: '#2ecc71', fontWeight: 600 }}>✓ Aplicada</span>
                          )}
                        </div>
                      </div>
                    ))
                }

                {((tab === 'productos' && productosFiltrados.length === 0) ||
                  (tab === 'combos'    && combosFiltrados.length === 0) ||
                  (tab === 'promociones' && promocionesFiltradas.length === 0)) && (
                  <p style={{ color: 'var(--text-muted)', gridColumn: '1/-1', textAlign: 'center', marginTop: '40px' }}>
                    {busqueda ? 'Sin resultados para esa búsqueda' : 'No hay elementos disponibles'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ════════════ Panel derecho: carrito ════════════ */}
          <div style={{
            width: '300px', flexShrink: 0,
            borderLeft: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            background: 'var(--card)'
          }}>
            {/* Encabezado carrito */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>🛒 Pedido actual</h3>
              {(carrito.length > 0 || promocionesAplicadas.length > 0) && (
                <button
                  onClick={limpiarCarrito}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px' }}
                >
                  ✕ Limpiar
                </button>
              )}
            </div>

            {/* Listado del carrito */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
              {carrito.length === 0 && promocionesAplicadas.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
                  <div style={{ fontSize: '42px', marginBottom: '10px' }}>🛒</div>
                  <p style={{ fontSize: '13px' }}>Selecciona productos del menú</p>
                </div>
              ) : (
                <>
                  {carrito.map(item => (
                    <div key={item.key} style={{
                      display: 'flex', gap: '10px', alignItems: 'center',
                      padding: '10px 0', borderBottom: '1px solid var(--border)'
                    }}>
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '7px',
                        overflow: 'hidden', flexShrink: 0, background: 'var(--surface)'
                      }}>
                        {item.imagen_url ? (
                          <img
                            src={item.imagen_url}
                            alt={item.nombre}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: '100%', fontSize: '20px'
                          }}>
                            {item.tipo === 'combo' ? '🎁' : '🍔'}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>{item.nombre}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--gold-light)' }}>
                          ${(item.precio * item.cantidad).toFixed(2)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button style={btnCantidad} onClick={() => cambiarCantidad(item.key, -1)}>−</button>
                        <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>
                          {item.cantidad}
                        </span>
                        <button style={btnCantidad} onClick={() => cambiarCantidad(item.key, +1)}>+</button>
                        <button
                          style={{ ...btnCantidad, marginLeft: '4px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          onClick={() => quitarDelCarrito(item.key)}
                        >✕</button>
                      </div>
                    </div>
                  ))}
                  {promocionesAplicadas.map(promo => {
                    const desc = calcularDescuento(promo, itemsSinPromo);
                    const info = TIPOS_PROMO[promo.tipo] || { icon: '🏷️', label: promo.tipo };
                    return (
                      <div key={`promo-${promo.id}`} style={{
                        display: 'flex', gap: '10px', alignItems: 'center',
                        padding: '10px 0', borderBottom: '1px solid var(--border)',
                        opacity: desc > 0 ? 1 : 0.5,
                      }}>
                        <div style={{
                          width: '42px', height: '42px', borderRadius: '7px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, background: info.bg || 'var(--surface)',
                          fontSize: '20px',
                        }}>
                          {info.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            margin: 0, fontSize: '13px', fontWeight: 600, color: '#2ecc71',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}>{promo.nombre}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: '#2ecc71' }}>
                            -${desc.toFixed(2)}
                          </p>
                        </div>
                        <button
                          style={{ ...btnCantidad, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          onClick={() => quitarPromocion(promo.id)}
                        >✕</button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Total y acción */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Subtotal</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>${subtotal.toFixed(2)}</span>
              </div>
              {descuentoTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#2ecc71' }}>Descuentos</span>
                  <span style={{ fontSize: '12px', color: '#2ecc71' }}>-${descuentoTotal.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: '20px', color: 'var(--gold-light)' }}>
                  ${total.toFixed(2)}
                </span>
              </div>
              <button
                disabled={carrito.length === 0}
                style={{
                  width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
                  background: carrito.length === 0 ? 'var(--surface)' : 'var(--gold-light)',
                  color:      carrito.length === 0 ? 'var(--text-muted)' : '#000',
                  fontWeight: 700, fontSize: '14px',
                  cursor: carrito.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'opacity .2s'
                }}
              >
                💳 Procesar Pedido
              </button>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px', margin: '8px 0 0' }}>
                Módulo de pedidos disponible próximamente
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}