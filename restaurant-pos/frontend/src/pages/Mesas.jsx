import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import Sidebar from '../components/Sidebar';
import API from '../utils/api';

const ESTADO_MESA = {
  disponible: { label: 'Disponible', color: '#27ae60', icon: '\uD83D\uDFE2' },
  ocupada: { label: 'Ocupada', color: '#e74c3c', icon: '\uD83D\uDD34' },
  pagando: { label: 'Pagando', color: '#f39c12', icon: '\uD83D\uDFE1' },
};

export default function Mesas() {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useInactividad(300000, () => navigate('/login'));

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    cargarMesas();
    const interval = setInterval(cargarMesas, 10000);
    return () => clearInterval(interval);
  }, []);

  const cargarMesas = async () => {
    try {
      const { data } = await axios.get(`${API}/mesas`, { headers });
      setMesas(data || []);
      setError('');
    } catch (e) {
      setError('Error al cargar mesas');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClickMesa = (mesa) => {
    if (mesa.estado === 'disponible') return;
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <Sidebar usuario={usuario} activeRoute="mesas" />
        <main className="main-content" style={{ padding: '20px 24px', overflow: 'auto' }}>
          <p style={{ color: 'var(--text-muted)' }}>Cargando mesas...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="mesas" />
      <main className="main-content" style={{ padding: '20px 24px', overflow: 'auto' }}>
        <div className="page-header">
          <div>
            <h2 style={{ margin: 0 }}>Mapa del Restaurante</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Estado de las mesas en tiempo real</p>
          </div>
        </div>

        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '16px',
          marginTop: '20px',
        }}>
          {mesas.map(mesa => {
            const estado = ESTADO_MESA[mesa.estado] || ESTADO_MESA.disponible;
            return (
              <div
                key={mesa.id}
                onClick={() => handleClickMesa(mesa)}
                style={{
                  background: 'var(--card)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: `2px solid ${estado.color}`,
                  cursor: mesa.estado === 'disponible' ? 'default' : 'pointer',
                  transition: 'all .2s',
                  opacity: mesa.estado === 'disponible' ? 0.6 : 1,
                }}
                onMouseEnter={e => {
                  if (mesa.estado !== 'disponible') e.currentTarget.style.transform = 'scale(1.03)';
                }}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>
                    Mesa {mesa.numero}
                  </span>
                  <span style={{ fontSize: '14px' }}>{estado.icon}</span>
                </div>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: estado.color,
                  color: '#fff',
                }}>
                  {estado.label}
                </span>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Capacidad: {mesa.capacidad} pers.
                </p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
