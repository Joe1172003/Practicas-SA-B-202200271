import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/** Los datos del usuario que el gateway reenvía en headers. */
export interface UsuarioActual {
  id: string;
  correo: string;
}

/**
 * Saca del contexto de GraphQL quién está haciendo la petición.
 */
export function obtenerUsuarioActual(contexto: { req: Request }): UsuarioActual {
  const id = contexto.req.headers['x-usuario-id'];
  const correo = contexto.req.headers['x-usuario-correo'];

  if (typeof id !== 'string' || id.length === 0) {
    throw new UnauthorizedException(
      'Esta operación requiere iniciar sesión',
    );
  }

  return {
    id,
    // El correo solo se usa para las notificaciones. Si no viniera, la orden
    // debe poder crearse igual: no vale la pena tumbar una compra porque falte
    // el dato de a quién avisarle.
    correo: typeof correo === 'string' ? correo : 'desconocido',
  };
}
