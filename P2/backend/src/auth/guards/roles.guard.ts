import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../common/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestConUsuario } from '../request-con-usuario.interface';


@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // El reflector lee la metadata que pegó el decorador @Roles() en el método del controlador.
    const rolesPermitidos = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // Ruta protegida por sesión pero sin restricción de rol: basta con estar autenticado.
    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestConUsuario>();
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException('No hay sesión activa');
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      throw new ForbiddenException(
        'Tu rol no tiene permiso para acceder a este recurso',
      );
    }

    return true;
  }
}
