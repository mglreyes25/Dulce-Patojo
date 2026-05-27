import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, ShoppingCart, Target, Package,
  Download, RefreshCw,
} from 'lucide-react';
import API from '../utils/api';
import Sidebar from '../components/Sidebar';
import Pagination from '../components/Pagination';

const PERIODOS = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mes' },
  { value: 'custom', label: 'Personalizado' },
];

function SkeletonLoader({ lines = 4 }) {
  const widths = ['70%', '85%', '60%', '90%', '75%', '80%', '65%', '95%'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 20, width: widths[i % widths.length] }} />
      ))}
    </div>
  );
}

function TooltipContent({ active, payload, label }) {
  if (active && payload && payload.length) {
    const formatFecha = (f) => {
      if (!f) return '';
      const d = new Date(f);
      return d.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit' });
    };
    return (
      <div style={{
        background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{formatFecha(label)}</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#E4C97E', margin: '4px 0 0' }}>
          ${Number(payload[0].value).toFixed(2)}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '2px 0 0' }}>
          {payload[0]?.payload?.pedidos} pedidos
        </p>
      </div>
    );
  }
  return null;
}

export default function Reportes() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [periodo, setPeriodo] = useState('hoy');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const [ventas, setVentas] = useState(null);
  const [productos, setProductos] = useState(null);
  const [movimientos, setMovimientos] = useState(null);
  const [caja, setCaja] = useState(null);

  const [loadingVentas, setLoadingVentas] = useState(false);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);
  const [loadingCaja, setLoadingCaja] = useState(false);

  const [errorVentas, setErrorVentas] = useState('');
  const [errorProductos, setErrorProductos] = useState('');
  const [errorMovimientos, setErrorMovimientos] = useState('');
  const [errorCaja, setErrorCaja] = useState('');

  const [invFiltro, setInvFiltro] = useState('todos');
  const [invPagina, setInvPagina] = useState(1);
  const porPagina = 10;

  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('usuario') || '{}');
    setUsuario(u);
    if (u.rol !== 'Admin') { navigate('/dashboard'); return; }
  }, [navigate]);

  const getQueryParams = useCallback(() => {
    const params = { periodo };
    if (periodo === 'custom') {
      params.fecha_inicio = fechaInicio;
      params.fecha_fin = fechaFin;
    }
    return params;
  }, [periodo, fechaInicio, fechaFin]);

  const cargarVentas = useCallback(async () => {
    setLoadingVentas(true);
    setErrorVentas('');
    try {
      const res = await axios.get(`${API}/api/reportes/ventas`, { params: getQueryParams(), headers });
      setVentas(res.data);
    } catch (err) {
      setErrorVentas(err.response?.data?.error || 'Error al cargar ventas');
    } finally {
      setLoadingVentas(false);
    }
  }, [getQueryParams, headers]);

  const cargarProductos = useCallback(async () => {
    setLoadingProductos(true);
    setErrorProductos('');
    try {
      const res = await axios.get(`${API}/api/reportes/productos`, { params: { ...getQueryParams(), limite: 5 }, headers });
      setProductos(res.data);
    } catch (err) {
      setErrorProductos(err.response?.data?.error || 'Error al cargar productos');
    } finally {
      setLoadingProductos(false);
    }
  }, [getQueryParams, headers]);

  const cargarMovimientos = useCallback(async () => {
    setLoadingMovimientos(true);
    setErrorMovimientos('');
    setInvPagina(1);
    try {
      const params = getQueryParams();
      params.tipo = invFiltro;
      const res = await axios.get(`${API}/api/reportes/inventario`, { params, headers });
      setMovimientos(res.data);
    } catch (err) {
      setErrorMovimientos(err.response?.data?.error || 'Error al cargar movimientos');
    } finally {
      setLoadingMovimientos(false);
    }
  }, [getQueryParams, invFiltro, headers]);

  const cargarCaja = useCallback(async () => {
    setLoadingCaja(true);
    setErrorCaja('');
    try {
      const res = await axios.get(`${API}/api/reportes/caja`, { params: getQueryParams(), headers });
      setCaja(res.data);
    } catch (err) {
      setErrorCaja(err.response?.data?.error || 'Error al cargar caja');
    } finally {
      setLoadingCaja(false);
    }
  }, [getQueryParams, headers]);

  useEffect(() => {
    if (usuario?.rol !== 'Admin') return;
    cargarVentas();
    cargarProductos();
    cargarMovimientos();
    cargarCaja();
  }, [periodo, fechaInicio, fechaFin, usuario, cargarVentas, cargarProductos, cargarMovimientos, cargarCaja]);

  useEffect(() => {
    if (usuario?.rol !== 'Admin') return;
    cargarMovimientos();
  }, [invFiltro, cargarMovimientos, usuario]);

  if (!usuario || usuario.rol !== 'Admin') return null;

  const maxVendido = productos ? Math.max(...productos.map(p => p.cantidad_total), 1) : 1;
  const invMovs = movimientos?.movimientos || [];
  const totalPaginas = Math.max(1, Math.ceil(invMovs.length / porPagina));
  const invPaginados = invMovs.slice((invPagina - 1) * porPagina, invPagina * porPagina);

  const formatFecha = (f) => {
    if (!f) return '';
    const d = new Date(f);
    return d.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit' });
  };

  const exportCSV = () => {
    if (!ventas?.ventas_por_dia) return;
    let csv = 'Fecha,Total,Pedidos\n';
    ventas.ventas_por_dia.forEach(v => {
      csv += `${v.fecha},${v.total},${v.pedidos}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `reporte_ventas_${periodo}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };



  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="reportes" />
      <div className="main-content">
        <div className="page-header">
          <div>
            <h2 className="page-title">Reportes</h2>
            <p className="page-subtitle">Análisis de ventas, productos e inventario</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-secondary" onClick={() => { cargarVentas(); cargarProductos(); cargarMovimientos(); cargarCaja(); }}>
              <RefreshCw size={16} /> Actualizar
            </button>
            <button className="btn btn-primary" onClick={exportCSV}>
              <Download size={16} /> Exportar
            </button>
          </div>
        </div>

        <div className="reportes-period-selector">
          {PERIODOS.map(p => (
            <button
              key={p.value}
              className={`period-btn${periodo === p.value ? ' active' : ''}`}
              onClick={() => setPeriodo(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {periodo === 'custom' && (
          <div className="custom-date-inputs">
            <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Desde:</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={e => setFechaInicio(e.target.value)}
              className="filtro-input"
              style={{ minWidth: 160 }}
            />
            <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Hasta:</label>
            <input
              type="date"
              value={fechaFin}
              onChange={e => setFechaFin(e.target.value)}
              className="filtro-input"
              style={{ minWidth: 160 }}
            />
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon"><DollarSign size={28} color="var(--gold)" /></div>
            <div className="stat-value">
              {loadingVentas ? <div className="skeleton" style={{ height: 28, width: 100 }} /> : `$${(ventas?.total_ventas || 0).toFixed(2)}`}
            </div>
            <div className="stat-label">Ventas Totales</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><ShoppingCart size={28} color="var(--blue)" /></div>
            <div className="stat-value">
              {loadingVentas ? <div className="skeleton" style={{ height: 28, width: 60 }} /> : ventas?.total_pedidos || 0}
            </div>
            <div className="stat-label">Total Pedidos</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Target size={28} color="var(--green)" /></div>
            <div className="stat-value">
              {loadingVentas ? <div className="skeleton" style={{ height: 28, width: 80 }} /> : `$${(ventas?.ticket_promedio || 0).toFixed(2)}`}
            </div>
            <div className="stat-label">Ticket Promedio</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Package size={28} color="var(--purple)" /></div>
            <div className="stat-value">
              {loadingMovimientos ? <div className="skeleton" style={{ height: 28, width: 60 }} /> : (movimientos?.entradas || 0) + (movimientos?.salidas || 0)}
            </div>
            <div className="stat-label">Mov. Inventario</div>
          </div>
        </div>

        <div className="reportes-grid">
          <div className="reportes-chart-card">
            <h3>Ventas por día</h3>
            {errorVentas && <p style={{ color: 'var(--red)', fontSize: 13 }}>{errorVentas}</p>}
            {loadingVentas ? <SkeletonLoader lines={4} /> : (
              ventas?.ventas_por_dia?.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={ventas.ventas_por_dia}>
                    <CartesianGrid stroke="rgba(53,61,92,0.6)" strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" tickFormatter={formatFecha} stroke="var(--text-dim)" fontSize={12} />
                    <YAxis stroke="var(--text-dim)" fontSize={12} tickFormatter={v => `$${v}`} />
                    <Tooltip content={<TooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#C9A84C"
                      strokeWidth={2}
                      dot={{ fill: '#C9A84C', r: 4 }}
                      activeDot={{ fill: '#E4C97E', r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
                  Sin datos de ventas para este período
                </p>
              )
            )}
          </div>

          <div className="reportes-chart-card">
            <h3>Productos más vendidos</h3>
            {errorProductos && <p style={{ color: 'var(--red)', fontSize: 13 }}>{errorProductos}</p>}
            {loadingProductos ? <SkeletonLoader lines={5} /> : (
              productos?.length > 0 ? (
                productos.map((p, i) => (
                  <div key={p.producto_id || i} className="top-producto-row">
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt={p.nombre}
                        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'var(--surface)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, color: 'var(--text-dim)', flexShrink: 0,
                      }}>
                        {i + 1}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{p.nombre}</div>
                      <div className="top-producto-bar-track">
                        <div
                          className="top-producto-bar-fill"
                          style={{ width: `${(p.cantidad_total / maxVendido) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold-light)' }}>
                        {p.cantidad_total} uds
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        ${p.total_vendido.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
                  Sin datos de productos para este período
                </p>
              )
            )}
          </div>
        </div>

        <div className="card">
          <h3>Movimientos de Inventario</h3>
          <div className="filtros-bar" style={{ marginBottom: 16 }}>
            <select
              className="filtro-select"
              value={invFiltro}
              onChange={e => setInvFiltro(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="entrada">Entradas</option>
              <option value="salida">Salidas</option>
            </select>
          </div>
          {errorMovimientos && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{errorMovimientos}</p>}
          {loadingMovimientos ? <SkeletonLoader lines={6} /> : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {invPaginados.length > 0 ? invPaginados.map((m, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatFecha(m.fecha)}</td>
                      <td>{m.producto}</td>
                      <td>
                        <span className={`badge ${m.tipo === 'entrada' ? 'badge-success' : 'badge-danger'}`}>
                          {m.tipo}
                        </span>
                      </td>
                      <td>{m.cantidad}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.descripcion || '-'}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24 }}>
                        Sin movimientos en este período
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <Pagination currentPage={invPagina} totalPages={totalPaginas} onPageChange={setInvPagina} />
        </div>

        <div className="card">
          <h3>Resumen de Caja</h3>
          {errorCaja && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{errorCaja}</p>}
          {loadingCaja ? <SkeletonLoader lines={6} /> : (
            <>
              <div className="stats-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card" style={{ padding: 16 }}>
                  <div className="stat-value" style={{ fontSize: 22, color: 'var(--green)' }}>
                    ${(caja?.total_ingresos || 0).toFixed(2)}
                  </div>
                  <div className="stat-label">Total Ingresos</div>
                </div>
                <div className="stat-card" style={{ padding: 16 }}>
                  <div className="stat-value" style={{ fontSize: 22, color: 'var(--red)' }}>
                    ${(caja?.total_egresos || 0).toFixed(2)}
                  </div>
                  <div className="stat-label">Total Egresos</div>
                </div>
                <div className="stat-card" style={{ padding: 16 }}>
                  <div className="stat-value" style={{ fontSize: 22, color: (caja?.balance_neto || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    ${(caja?.balance_neto || 0).toFixed(2)}
                  </div>
                  <div className="stat-label">Balance Neto</div>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Monto</th>
                      <th>Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(caja?.movimientos || []).length > 0 ? caja.movimientos.map((m, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatFecha(m.fecha)}</td>
                        <td>
                          <span className={`badge ${m.tipo === 'ingreso' ? 'badge-success' : 'badge-danger'}`}>
                            {m.tipo}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>${Number(m.monto).toFixed(2)}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.descripcion || '-'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24 }}>
                          Sin movimientos de caja en este período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
