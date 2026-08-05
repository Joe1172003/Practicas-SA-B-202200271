import type { Request } from 'express';
import { JwtPayload } from './jwt-payload.interface';

// La petición de Express después de que JwtAuthGuard la dejó pasar.
export interface RequestConUsuario extends Request {
  usuario: JwtPayload;
}
