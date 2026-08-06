import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as apiAuth from '../api/auth';
import type { Usuario } from '../types/usuario';



interface ValorAuthContext {
  usuario: Usuario | null;
  cargando: boolean;
  iniciarSesion: (correo: string, password: string) => Promise<void>;
  registrarse: (datos: apiAuth.DatosRegistro) => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<ValorAuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  
  useEffect(() => {
    apiAuth.obtenerPerfil().then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  async function iniciarSesion(correo: string, password: string) {
    setUsuario(await apiAuth.login(correo, password));
  }

  async function registrarse(datos: apiAuth.DatosRegistro) {
    setUsuario(await apiAuth.registrar(datos));
  }

  async function cerrarSesion() {
    await apiAuth.logout();
    setUsuario(null);
  }

  return (
    // El valor del contexto es un objeto con el usuario y las funciones 
    // iniciarSesion, registrarse y cerrarSesion. Se pasa a todos los hijos de este provider.
    <AuthContext.Provider
      value={{ usuario, cargando, iniciarSesion, registrarse, cerrarSesion }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para leer la sesión desde cualquier componente:
*/
export function useAuth(): ValorAuthContext {
  const contexto = useContext(AuthContext);

  if (!contexto) {
    // Solo pasa si un componente usa el hook fuera de <AuthProvider>.
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }

  return contexto;
}
