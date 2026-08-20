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
 * Única puerta del gateway hacia el microservicio de Notificaciones.
 *
 */
@Injectable()
export class NotificacionesClienteService {
  private readonly logger = new Logger(NotificacionesClienteService.name);

  constructor(
    @Inject(serviciosConfig.KEY)
    private readonly servicios: ServiciosConfig,
  ) {}

  // El correo NO lo elige quien llama a la API: lo pone el controlador con el de la sesión ya validada.
  async historial(correo: string, limite: number): Promise<unknown> {
    const url = `${this.servicios.notificaciones}/notificaciones`;

    try {
      const respuesta = await axios.get(url, {
        params: { email: correo, limite },
        timeout: 5000,
      });

      return respuesta.data;
    } catch (error) {
      const motivo = error instanceof Error ? error.message : 'desconocido';
      this.logger.error(`No se pudo contactar a Notificaciones: ${motivo}`);

      throw new ServiceUnavailableException(
        'El servicio de notificaciones no está disponible',
      );
    }
  }
}