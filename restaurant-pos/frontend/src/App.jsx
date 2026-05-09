import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Usuarios from './pages/Usuarios';
import Productos from './pages/Productos';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/"          element={<Navigate to="/login" replace />} />
      <Route path="/login"     element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/usuarios"  element={<Usuarios />} />
      <Route path="/productos" element={<Productos />} />
      <Route path="/caja"      element={<Dashboard />} />
      <Route path="/cocina"    element={<Dashboard />} />
      <Route path="/despacho"  element={<Dashboard />} />
      <Route path="*"          element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;