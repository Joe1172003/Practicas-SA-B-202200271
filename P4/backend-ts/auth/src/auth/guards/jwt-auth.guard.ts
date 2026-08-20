import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { CookieService } from '../cookie.service';
import { RequestConUsuario } from '../request-con-usuario.interface';
import { TokenService } from '../token.service';

/**
 * Guard de autenticación: decide si la petición trae una sesión válida.
 *
 * Aquí es donde se cumple el requisito de la Renovacion automatica. El flujo
 * seria:
 *
 *   1. Sacar el token de la cookie HTTP-only. Si no hay, 401.
 *   2. Pedirle a TokenService que lo valide.
 *   3. Si el token venció hace menos de JWT_RENEWAL_GRACE_SECONDS, firmar uno
 *      nuevo y reemplazar la cookie en la misma respuesta. El usuario no se
 *      entera: su petición se atiende con normalidad y se va con una sesión
 *      fresca.
 *   4. Colgar el usuario en la petición para que lo usen el guard de roles y
 *      los controladores.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService, private readonly cookies: CookieService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    // request de express, pero con el usuario colgado por este guard
    const request = http.getRequest<RequestConUsuario>();
    // response de express, para poder renovar la cookie si toca
    const response = http.getResponse<Response>();

    const token = this.cookies.leerToken(request);

    if (!token) {
      throw new UnauthorizedException('No hay sesión activa');
    }

    const { payload, necesitaRenovacion } = await this.tokens.verificar(token);

    if (necesitaRenovacion) {
      await this.renovarSesion(response, payload.sub, payload.rol);
    }

    request.usuario = { sub: payload.sub, rol: payload.rol };

    return true;
  }

  private async renovarSesion(response: Response, sub: string, rol: RequestConUsuario['usuario']['rol']): Promise<void> {
    const tokenNuevo = await this.tokens.firmar({ sub, rol });

    this.cookies.establecerToken(response, tokenNuevo);
    response.setHeader('X-Token-Renovado', 'true');
  }
}
