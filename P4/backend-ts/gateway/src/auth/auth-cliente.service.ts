import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import { serviciosConfig } from '../config/servicios.config';
import type { ServiciosConfig } from '../config/servicios.config';

/**
 * Lo que devuelve el microservicio de autenticación, ya desarmado en las tres
 * piezas que al gateway le interesan.
 */
export interface RespuestaDeAuth {
  status: number;
  datos: unknown;

  // El header Set-Cookie que mandó Auth. Es lo que lleva el JWT.
  // Es un arreglo porque HTTP permite mandar varias cookies en una respuesta.
  cookies?: string[];
}

interface OpcionesDeLlamada {
  metodo: 'GET' | 'POST';
  ruta: string;
  cuerpo?: unknown;

  // La cookie que mandó el navegador, tal cual llegó. Se reenvía a Auth para
  // que su propio guard pueda leer el JWT.
  cookie?: string;
}

/**
 * Única puerta del gateway hacia el microservicio de autenticación.
 *
 * Se usa axios directo con axios la llamada se lee de corrido y es más fácil de explicar.
 */
@Injectable()
export class AuthClienteService {
  private readonly logger = new Logger(AuthClienteService.name);

  constructor( @Inject(serviciosConfig.KEY) private readonly servicios: ServiciosConfig) {}

  async llamar(opciones: OpcionesDeLlamada): Promise<RespuestaDeAuth> {
    const url = `${this.servicios.auth}${opciones.ruta}`;

    try {
      const respuesta = await axios.request({
        method: opciones.metodo,
        url,
        data: opciones.cuerpo,
        headers: opciones.cookie ? { Cookie: opciones.cookie } : {},

        // Si Auth tarda más de 5 segundos, damos la llamada por perdida. Sin
        // timeout, una petición colgada dejaría al gateway esperando para
        // siempre y se irían acumulando conexiones.
        timeout: 5000,

        // si la respuesta no es 200, axios no lanza excepción y la respuesta se devuelve tal cual al cliente.
        // con esto, axios solo lanza excepción si de verdad no hubo respuesta (servicio caído).
        validateStatus: () => true,
      });

      return {
        status: respuesta.status,
        datos: respuesta.data,
        cookies: respuesta.headers['set-cookie'],
      };
    } catch (error) {
      // Llegar aquí significa que el contenedor de Auth está caído
      const motivo = error instanceof Error ? error.message : 'desconocido';
      this.logger.error(`No se pudo contactar a Auth en ${url}: ${motivo}`);

      throw new ServiceUnavailableException(
        'El servicio de autenticación no está disponible',
      );
    }
  }
}
