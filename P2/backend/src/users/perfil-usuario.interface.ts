import { Role } from '../common/role.enum';

export interface PerfilUsuario {
  id: string;
  nombre: string;
  correo: string;
  rol: Role;
}
