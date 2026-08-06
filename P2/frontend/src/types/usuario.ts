export type Rol = 'ADMIN' | 'CLIENTE';

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
}