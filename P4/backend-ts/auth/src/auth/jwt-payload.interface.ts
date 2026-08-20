import { Role } from '../common/role.enum';


/// El payload solo contiene el id del usuario y su rol.
export interface JwtPayload {
  sub: string;
  rol: Role;
}

export interface JwtPayloadFirmado extends JwtPayload {
  // El iat y exp los agrega automáticamente la librería que firma el JWT.
  iat: number; // iminito en
  exp: number; // expiración
}
