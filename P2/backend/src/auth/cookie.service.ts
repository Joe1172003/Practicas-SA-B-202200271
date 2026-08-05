import { Inject, Injectable } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { cookieConfig } from '../config/cookie.config';
import type { CookieConfig } from '../config/cookie.config';
import { TokenService } from './token.service';


@Injectable()
export class CookieService {
  constructor(@Inject(cookieConfig.KEY)  private readonly config: CookieConfig, private readonly tokenService: TokenService) {}

  get nombre(): string {
    return this.config.name;
  }

  // Lee el token de la petición entrante lo llena el middleware cookie-parser.
  leerToken(request: Request): string | undefined {
    return request.cookies?.[this.config.name] as string | undefined;
  }

  establecerToken(response: Response, token: string): void {
    response.cookie(this.config.name, token, this.opciones());
  }


  limpiarToken(response: Response): void {
    response.clearCookie(this.config.name, this.opcionesBase());
  }

  // Atributos que identifican la cookie, tanto al crearla como al borrarla.
  private opcionesBase(): CookieOptions {
    return {
      // El navegador la guarda, pero javaScript no puede leerla.
      httpOnly: true,

      // Solo viaja por HTTPS. En localhost va en false porque si no, el
      // navegador descartaría la cookie sin avisar y el login parecería roto.
      secure: this.config.secure,

      // 'lax' evita que la cookie se mande en peticiones de otros sitios,
      sameSite: this.config.secure ? 'none' : 'lax',

      path: '/',
    };
  }

  private opciones(): CookieOptions {
    return {
      ...this.opcionesBase(),

      // la cookie tiene que durar MÁS que el token.
      // El token vive 60 segundos. Si la cookie también durara 60, el
      // navegador la borraría en el mismo instante en que el token expira y la
      // renovación automática nunca podría ocurrir: no quedaría token que
      // presentar. 
      maxAge:
        (this.tokenService.duracionSegundos +
          this.tokenService.graciaSegundos) *
        1000,
    };
  }
}
