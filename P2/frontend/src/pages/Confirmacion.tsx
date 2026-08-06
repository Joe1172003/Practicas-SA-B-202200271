import { CheckCircleFill } from 'react-bootstrap-icons';
import { Navbar } from '../components/Navbar';
import { Tarjeta } from '../components/Tarjeta';
import { useAuth } from '../context/AuthContext';


export function Confirmacion() {
  const { usuario } = useAuth();

  // RutaProtegida garantiza que aquí siempre hay usuario.
  if (!usuario) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />

      <main className="flex flex-1 items-center justify-center px-4">
        <Tarjeta>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircleFill className="h-8 w-8 text-green-700" />
            </div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              ¡Bienvenido, {usuario.nombre}!
            </h1>
            <p className="text-sm text-gray-500">Tu sesión se inició correctamente.</p>
          </div>

          <dl className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Correo</dt>
              <dd className="font-medium text-gray-900">{usuario.correo}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Rol</dt>
              <dd className="font-medium text-gray-900">{usuario.rol.toLocaleLowerCase()}</dd>
            </div>
          </dl>
        </Tarjeta>
      </main>
    </div>
  );
}