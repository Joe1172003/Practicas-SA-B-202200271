import type { Rol } from '../types/usuario';
import { obtener } from './client';



// api/reportes y api/dashboard son rutas protegidas por JwtAuthGuard. 
// El backend exige que el usuario tenga sesión y, en el caso de reportes, que sea ADMIN.
//  Si no se cumplen estas condiciones, el backend responde 401 o 403 y la función lanza ErrorApi.

// aqui el frontend no valida el rol todo esto lo valida el backend
export interface RespuestaProtegida {
  mensaje: string;
  recurso: string;
  requiere: Rol[];
  accedidoPor: { id: string; rol: Rol };
}

export async function obtenerReportes(): Promise<RespuestaProtegida> {
  return obtener<RespuestaProtegida>('/api/reportes');
}

export async function obtenerDashboard(): Promise<RespuestaProtegida> {
  return obtener<RespuestaProtegida>('/api/dashboard');
}