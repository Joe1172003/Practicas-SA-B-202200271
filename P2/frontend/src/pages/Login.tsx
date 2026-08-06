import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ErrorApi } from '../api/client';
import { Alerta } from '../components/Alerta';
import { Boton } from '../components/Boton';
import { CampoTexto } from '../components/CampoTexto';
import { Tarjeta } from '../components/Tarjeta';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { usuario, iniciarSesion } = useAuth();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const navegar = useNavigate();
  
  if (usuario) {
    return <Navigate to="/confirmacion" replace />;
  }

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault(); // que el navegador no recargue la página
    setError(null);
    setEnviando(true);

    try {
      await iniciarSesion(correo, password);
      navegar('/confirmacion');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.mensaje : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Tarjeta>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900">Iniciar sesion</h1>
        </div>

        <Alerta tipo="error" mensaje={error} />

        <form onSubmit={(e) => void manejarEnvio(e)} className="flex flex-col gap-4">
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
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <Boton type="submit" cargando={enviando}>
            Entrar
          </Boton>
        </form>

        <p className="text-center text-sm text-gray-500">
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="font-medium text-indigo-400 hover:underline">
            Regístrate
          </Link>
        </p>
      </Tarjeta>
    </main>
  );
}