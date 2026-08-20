import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';

/**
 * Deja pasar solo si quien llama es ADMIN.
 * Productos no valida el JWT. Ni siquiera conoce el JWT_SECRET. Quien
 * autentica es el gateway: él lee la cookie, le pregunta a Auth de quién es la
 * sesión, y reenvía la respuesta en dos headers simples, `x-usuario-id` y
 * `x-usuario-rol`. Aquí solo se lee el rol de ese header.
 *
 * Esa es la diferencia entre autenticar lo hace Auth y
 * autorizar lo hace cada servicio con sus propias reglas.
 */
@Injectable()
export class SoloAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Una petición de GraphQL no es una petición HTTP normal para Nest: hay que
    // desenvolverla con GqlExecutionContext para llegar al request de Express.
    const contextoGql = GqlExecutionContext.create(context);
    const request = contextoGql.getContext<{ req: Request }>().req;

    const rol = request.headers['x-usuario-rol'];

    if (!rol) {
      throw new ForbiddenException(
        'Esta operación requiere iniciar sesión',
      );
    }

    if (rol !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo un usuario con rol ADMIN puede modificar el catálogo',
      );
    }

    return true;
  }
}
