import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthClienteService } from './auth-cliente.service';
import type { RespuestaDeAuth } from './auth-cliente.service';
import { LoginDto } from './dto/login.dto';
import { RegistrarDto } from './dto/registrar.dto';
import { SesionGuard } from './sesion.guard';
import type { RequestConUsuario } from './usuario-de-sesion.interface';

/**
 * Enruta /auth/* hacia el microservicio de autenticación.
 * El gateway es el único que habla con el navegador, así que es él quien pone
 * la cookie HTTP-only en la respuesta: toma el Set-Cookie que le devolvió Auth
 * y lo copia a su propia respuesta.
 */
@Controller('auth')
export class AuthProxyController {
  constructor(private readonly authCliente: AuthClienteService) {}

  @Post('register')
  async registrar(
    @Body() dto: RegistrarDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const respuesta = await this.authCliente.llamar({
      metodo: 'POST',
      ruta: '/auth/register',
      cuerpo: dto,
    });

    return this.reenviar(respuesta, response);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const respuesta = await this.authCliente.llamar({
      metodo: 'POST',
      ruta: '/auth/login',
      cuerpo: dto,
    });

    return this.reenviar(respuesta, response);
  }

  @Post('logout')
  async logout(
    @Req() request: RequestConUsuario,
    @Res({ passthrough: true }) response: Response,
  ) {
    const respuesta = await this.authCliente.llamar({
      metodo: 'POST',
      ruta: '/auth/logout',
      cookie: request.headers.cookie,
    });

    return this.reenviar(respuesta, response);
  }

  @Get('me')
  @UseGuards(SesionGuard)
  miPerfil(@Req() request: RequestConUsuario) {
    // El guard ya le preguntó a Auth quién es el dueño de la cookie y dejó el
    // usuario colgado en la petición.
    return { usuario: request.usuario };
  }

  /**
   * Copia al cliente la respuesta que dio Auth: su código de estado, su cuerpo
   * y, sobre todo, su cookie.
   *
   * Devolver el status original importa. Si Auth contesta 409 porque el correo
   * ya existe, el cliente tiene que ver un 409, no un 200 con un mensaje de
   * error escondido adentro.
   */
  private reenviar(respuesta: RespuestaDeAuth, response: Response): unknown {
    if (respuesta.cookies) {
      response.setHeader('Set-Cookie', respuesta.cookies);
    }

    response.status(respuesta.status);

    return respuesta.datos;
  }
}
