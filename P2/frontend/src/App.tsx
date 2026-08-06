import { Navigate, Route, Routes } from 'react-router-dom';
import { RutaProtegida } from './components/RutaProtegida';
import { Confirmacion } from './pages/Confirmacion';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Registro } from './pages/Registro';
import { Reportes } from './pages/Reportes';


function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />

      {/* Protegidas (requieren sesión) */}
      <Route
        path="/confirmacion"
        element={
          <RutaProtegida>
            <Confirmacion />
          </RutaProtegida>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RutaProtegida>
            <Dashboard />
          </RutaProtegida>
        }
      />
      <Route
        path="/reportes"
        element={
          <RutaProtegida>
            <Reportes />
          </RutaProtegida>
        }
      />

      {/* Cualquier otra ruta redirige a confirmación */}
      <Route path="*" element={<Navigate to="/confirmacion" replace />} />
    </Routes>
  );
}

export default App;