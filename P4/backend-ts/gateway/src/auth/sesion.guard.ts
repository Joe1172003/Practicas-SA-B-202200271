import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthClienteService } from './auth-cliente.service';
import type { RequestConUsuario } from './usuario-de-sesion.interface';

/**
 * Guard de sesión del gateway decide si una petición trae un JWT válido.
 *
 * este guard no verifica la firma del JWT él mismo
 * Le reenvía la cookie al microservicio de autenticación y le pregunta de quien es la sesion llamando a `GET /auth/me`
 *
 *   1. el microservicio de autenticación ya tiene toda esa lógica escrita y probada
 *   2. El JWT_SECRET se queda viviendo en un solo servicio. Entre menos
 *      contenedores conozcan el secreto, mejor.
 *   3. Si mañana se revoca una sesión, el gateway se entera de inmediato
 *      porque pregunta cada vez. Un token verificado localmente seguiría
 *      pareciendo válido hasta que expire.
 */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(private readonly authCliente: AuthClienteService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestConUsuario>();
    const response = http.getResponse<Response>();

    const cookie = request.headers.cookie;

    if (!cookie) {
      throw new UnauthorizedException('No hay sesión activa');
    }

    const respuesta = await this.authCliente.llamar({
      metodo: 'GET',
      ruta: '/auth/me',
      cookie,
    });

    if (respuesta.status !== 200) {
      throw new UnauthorizedException('La sesión no es válida o ya expiró');
    }

    // Aquí es donde sigue viva la renovación automática del microservicio de autenticación:
    // si el token estaba vencido pero dentro del periodo de gracia, Auth firmó
    // uno nuevo y lo devolvió en un Set-Cookie. El gateway lo pasa al
    // navegador. Si no reenviáramos esta cookie, el usuario se quedaría con el
    // token viejo y la sesión moriría aunque Auth la hubiera renovado.
    if (respuesta.cookies) {
      response.setHeader('Set-Cookie', respuesta.cookies);
    }

    const cuerpo = respuesta.datos as { usuario: RequestConUsuario['usuario'] };

    // Se cuelga el usuario en la petición para que los controladores lo usen
    // sin tener que volver a preguntarle a Auth.
    request.usuario = cuerpo.usuario;

    return true;
  }
}
