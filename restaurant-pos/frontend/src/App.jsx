import { Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Usuarios from './pages/Usuarios';
import Productos from './pages/Productos';
import Caja from './pages/Caja';
import Promociones from './pages/Promociones';
import Inventario from './pages/Inventario';
import Mesas from './pages/Mesas';
import Cocina from './pages/Cocina';
import Despacho from './pages/Despacho';
import Ingredientes from './pages/Ingredientes';
import Recetas from './pages/Recetas';
import Reportes from './pages/Reportes';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
      <Route path="/usuarios" element={<ErrorBoundary><Usuarios /></ErrorBoundary>} />
      <Route path="/productos" element={<ErrorBoundary><Productos /></ErrorBoundary>} />
      <Route path="/caja" element={<ErrorBoundary><Caja /></ErrorBoundary>} />
      <Route path="/promociones" element={<ErrorBoundary><Promociones /></ErrorBoundary>} />
      <Route path="/inventario" element={<ErrorBoundary><Inventario /></ErrorBoundary>} />
      <Route path="/ingredientes" element={<ErrorBoundary><Ingredientes /></ErrorBoundary>} />
      <Route path="/recetas" element={<ErrorBoundary><Recetas /></ErrorBoundary>} />
      <Route path="/reportes" element={<ErrorBoundary><Reportes /></ErrorBoundary>} />
      <Route path="/mesas" element={<ErrorBoundary><Mesas /></ErrorBoundary>} />
      <Route path="/cocina" element={<ErrorBoundary><Cocina /></ErrorBoundary>} />
      <Route path="/despacho" element={<ErrorBoundary><Despacho /></ErrorBoundary>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;