import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { EVENTO_TOKEN_RENOVADO } from '../api/client';
import { useAuth } from '../context/AuthContext';


export function Navbar() {
  const { usuario, cerrarSesion } = useAuth();
  const [sesionRenovada, setSesionRenovada] = useState(false);
  const navegar = useNavigate();

  useEffect(() => {
    function alRenovarse() {
      setSesionRenovada(true);
      setTimeout(() => setSesionRenovada(false), 4000);
    }

    window.addEventListener(EVENTO_TOKEN_RENOVADO, alRenovarse);
    return () => window.removeEventListener(EVENTO_TOKEN_RENOVADO, alRenovarse);
  }, []);

  async function manejarSalir() {
    await cerrarSesion();
    navegar('/login');
  }

  function claseDeLink({ isActive }: { isActive: boolean }) {
    return isActive
      ? 'rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700'
      : 'rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100';
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <nav className="flex items-center gap-2">
        <NavLink to="/confirmacion" className={claseDeLink}>
          Inicio
        </NavLink>
        <NavLink to="/dashboard" className={claseDeLink}>
          Dashboard
        </NavLink>
        <NavLink to="/reportes" className={claseDeLink}>
          Reportes
        </NavLink>
      </nav>

      <div className="flex items-center gap-4">
        {sesionRenovada && (
          <span className="rounded-full bg-green-700 px-3 py-1 text-xs font-medium text-white">
            Sesión renovada automáticamente
          </span>
        )}

        {usuario && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">{usuario.nombre}</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
              {usuario.rol.toLocaleLowerCase()}
            </span>
          </div>
        )}

        <button
          onClick={() => void manejarSalir()}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium
                     text-gray-700 hover:bg-gray-100"
        >
          Salir
        </button>
      </div>
    </header>
  );
}