import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload } from '../jwt-payload.interface';
import { RequestConUsuario } from '../request-con-usuario.interface';

/* Inyecta en el controlador el usuario de la sesión */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<RequestConUsuario>();

    if (!request.usuario) {
      // Solo pasa si a la ruta se le olvidó poner JwtAuthGuard. Es un error de
      // programación, y es mejor que reviente aquí a que el controlador siga
      // con un usuario indefinido.
      throw new UnauthorizedException('La ruta no validó la sesión');
    }

    return request.usuario;
  },
);
