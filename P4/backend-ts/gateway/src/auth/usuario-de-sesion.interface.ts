import type { Request } from 'express';
import { Role } from '../common/role.enum';


export interface UsuarioDeSesion {
  id: string;
  nombre: string;
  correo: string;
  rol: Role;
}

// La petición de Express después de que SesionGuard la dejó pasar.
export interface RequestConUsuario extends Request {
  usuario: UsuarioDeSesion;
}
