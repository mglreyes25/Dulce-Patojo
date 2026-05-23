import { useState, useEffect, useRef } from 'react';

export default function BloqueoTimer({ iniciadoEn, timeoutMinutos = 5, onLiberar, esAdmin }) {
  const [tiempoSegundos, setTiempoSegundos] = useState(0);
  const [expirado, setExpirado] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    const calcular = () => {
      if (!iniciadoEn) return;
      const inicio = new Date(iniciadoEn).getTime();
      const ahora = Date.now();
      const segs = Math.floor((ahora - inicio) / 1000);
      setTiempoSegundos(segs);
      setExpirado(segs >= timeoutMinutos * 60);
    };

    calcular();
    intervalRef.current = setInterval(calcular, 1000);
    return () => clearInterval(intervalRef.current);
  }, [iniciadoEn, timeoutMinutos]);

  const minutos = Math.floor(tiempoSegundos / 60);
  const segundos = tiempoSegundos % 60;
  const tiempoStr = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

  return (
    <span className={`bloqueo-timer${expirado ? ' bloqueo-timer--expired' : ''}`} title={`Bloqueo iniciado hace ${tiempoStr}`}>
      <span className="bloqueo-timer-icon">⏱</span>
      <span className="bloqueo-timer-time">{tiempoStr}</span>
      {expirado && (
        <span className="bloqueo-timer-expired-label">Expirado</span>
      )}
      {onLiberar && (expirado || esAdmin) && (
        <button
          className="bloqueo-timer-liberar"
          onClick={(e) => { e.stopPropagation(); onLiberar(); }}
          title="Liberar bloqueo"
        >
          Liberar
        </button>
      )}
    </span>
  );
}
