import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useInactividad } from '../hooks/useInactividad';
import Sidebar from '../components/Sidebar';
import useSocket from '../hooks/useSocket';
import API from '../utils/api';

const ESTADO_MESA = {
  disponible: { label: 'Disponible', color: 'var(--green)', iconColor: 'var(--green)' },
  ocupada: { label: 'Ocupada', color: 'var(--red)', iconColor: 'var(--red)' },
  pagando: { label: 'Pagando', color: 'var(--amber)', iconColor: 'var(--amber)' },
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

  const cargarMesas = async () => {
    try {
      const { data } = await axios.get(`${API}/mesas`, { headers });
      setMesas(data || []);
      setError('');
    } catch (e) {
      setError('Error al cargar mesas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    cargarMesas();
    const interval = setInterval(cargarMesas, 30000);
    return () => clearInterval(interval);
  }, []);

  useSocket({
    cambio_estado: () => cargarMesas(),
    mesa_actualizada: () => cargarMesas(),
  });

  const handleClickMesa = (mesa) => {
    if (mesa.estado === 'disponible') return;
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <Sidebar usuario={usuario} activeRoute="mesas" />
        <main className="main-content">
          <p className="loading-text">
            <Loader2 size={20} className="spin" style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Cargando mesas...
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="mesas" />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h2 className="page-title">Mapa del Restaurante</h2>
            <p className="page-subtitle">Estado de las mesas en tiempo real</p>
          </div>
        </div>

        {error && <div className="message error-message">{error}</div>}

        <div className="mesas-grid">
          {mesas.map(mesa => {
            const estado = ESTADO_MESA[mesa.estado] || ESTADO_MESA.disponible;
            return (
              <div
                key={mesa.id}
                onClick={() => handleClickMesa(mesa)}
                className={`mesa-card mesa-card--${mesa.estado || 'disponible'}`}
              >
                <div className="mesa-card-numero">{mesa.numero}</div>
                <div className={`mesa-card-estado mesa-card-estado--${mesa.estado || 'disponible'}`}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: estado.iconColor, display: 'inline-block',
                  }} />
                  {estado.label}
                </div>
                <div className="mesa-card-capacidad">
                  Capacidad: {mesa.capacidad} pers.
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
