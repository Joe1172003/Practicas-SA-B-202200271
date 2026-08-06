import { useEffect, useState } from 'react';
import { PersonXFill } from 'react-bootstrap-icons';
import { ErrorApi } from '../api/client';
import { obtenerReportes, type RespuestaProtegida } from '../api/protegido';
import { Alerta } from '../components/Alerta';
import { Navbar } from '../components/Navbar';
import { Tarjeta } from '../components/Tarjeta';
import { useAuth } from '../context/AuthContext';


export function Reportes() {
  const { usuario } = useAuth();
  const [datos, setDatos] = useState<RespuestaProtegida | null>(null);
  const [error, setError] = useState<ErrorApi | null>(null);

  useEffect(() => {
    obtenerReportes()
      .then(setDatos)
      .catch((e: unknown) => {
        setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'Error inesperado'));
      });
  }, []);

  const accesoDenegado = error?.status === 403;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />

      <main className="flex flex-1 items-start justify-center px-4 py-10">
        <Tarjeta ancho="grande">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
            <span className="rounded-full bg-green-800 px-3 py-1 text-xs font-semibold text-white">
              Solo Admin
            </span>
          </div>

          {!datos && !error && <p className="text-gray-500">Cargando…</p>}

          {accesoDenegado && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <PersonXFill className="h-7 w-7 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Acceso denegado</h2>
              <p className="max-w-sm text-sm text-gray-500">
                El servidor respondió <span className="font-mono font-semibold">403</span>:
                tu rol actual (<span className="font-semibold">{usuario?.rol}</span>) no
                tiene permiso para este recurso.
              </p>
            </div>
          )}

          {error && !accesoDenegado && <Alerta tipo="error" mensaje={error.mensaje} />}

          {datos && (
            <div className="flex flex-col gap-4">
              <Alerta tipo="exito" mensaje={datos.mensaje} />

              <dl className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Roles permitidos</dt>
                  <dd className="font-medium text-gray-900">
                    {datos.requiere.join(', ').toLocaleLowerCase()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Accediste con el rol</dt>
                  <dd className="font-medium text-indigo-700">
                    {datos.accedidoPor.rol.toLocaleLowerCase()}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </Tarjeta>
      </main>
    </div>
  );
}