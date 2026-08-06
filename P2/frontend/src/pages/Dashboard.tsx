import { useEffect, useState } from 'react';
import { ErrorApi } from '../api/client';
import { obtenerDashboard, type RespuestaProtegida } from '../api/protegido';
import { Alerta } from '../components/Alerta';
import { Navbar } from '../components/Navbar';
import { Tarjeta } from '../components/Tarjeta';


export function Dashboard() {
  const [datos, setDatos] = useState<RespuestaProtegida | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerDashboard().then(setDatos)
      .catch((e: unknown) =>
        setError(e instanceof ErrorApi ? e.mensaje : 'Error inesperado'),
      );
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />

      <main className="flex flex-1 items-start justify-center px-4 py-10">
        <Tarjeta ancho="grande">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          </div>

          <Alerta tipo="error" mensaje={error} />

          {!datos && !error && <p className="text-gray-500">Cargando…</p>}

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