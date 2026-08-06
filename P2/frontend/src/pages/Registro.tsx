import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ErrorApi } from '../api/client';
import { Alerta } from '../components/Alerta';
import { Boton } from '../components/Boton';
import { CampoTexto } from '../components/CampoTexto';
import { Tarjeta } from '../components/Tarjeta';
import { useAuth } from '../context/AuthContext';
import type { Rol } from '../types/usuario';

export function Registro() {
  const { usuario, registrarse } = useAuth();
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<Rol>('CLIENTE');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const navegar = useNavigate();

  if (usuario) {
    return <Navigate to="/confirmacion" replace />;
  }

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      await registrarse({ nombre, correo, password, rol });
      navegar('/confirmacion');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.mensaje : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  }

  function BotonRol({ valor }: { valor: Rol }) {
    const activo = rol === valor;
    return (
      <button
        type="button"
        onClick={() => setRol(valor)}
        className={
          activo
            ? 'flex-1 rounded-lg border-0 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700'
            : 'flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50'
        }
      >
        {valor}
      </button>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Tarjeta>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="text-sm text-gray-500">
            El registro deja la sesión iniciada automáticamente
          </p>
        </div>

        <Alerta tipo="error" mensaje={error} />

        <form onSubmit={(e) => void manejarEnvio(e)} className="flex flex-col gap-4">
          <CampoTexto
            label="Nombre"
            value={nombre}
            onChange={setNombre}
            placeholder="Tu nombre completo"
            autoComplete="name"
          />
          <CampoTexto
            label="Correo"
            type="email"
            value={correo}
            onChange={setCorreo}
            placeholder="tu@correo.com"
            autoComplete="email"
          />
          <CampoTexto
            label="Contraseña"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
          />

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Rol de la cuenta</span>
            {/* Poder elegir ADMIN desde aquí es una concesión de la práctica,
                para crear las dos cuentas y probar las rutas protegidas. */}
            <div className="flex gap-2">
              <BotonRol valor="CLIENTE" />
              <BotonRol valor="ADMIN" />
            </div>
          </div>

          <Boton type="submit" cargando={enviando}>
            Registrarme
          </Boton>
        </form>

        <p className="text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </Tarjeta>
    </main>
  );
}