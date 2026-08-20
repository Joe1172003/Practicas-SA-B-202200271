import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { serviciosConfig } from '../config/servicios.config';
import type { ServiciosConfig } from '../config/servicios.config';

/**
 *   - Apartar stock CAMBIA LA DECISIÓN. Según lo que conteste Productos, la
 *     orden sigue o se rechaza. No hay forma de continuar sin esa respuesta.
 *
 *   - Notificar no cambia nada. La orden ya está pagada, el stock ya se
 *     descontó, el negocio ya ocurrió. Que el correo salga o no salga no
 *     modifica ni un dato. Es un aviso, no un paso.
 *
 * Y por eso, si Notificaciones está caído, sería absurdo tumbar una compra que
 * ya se completó. El cliente pagó: su orden vale.
 */
@Injectable()
export class NotificacionesCliente {
  private readonly logger = new Logger(NotificacionesCliente.name);

  constructor(
    @Inject(serviciosConfig.KEY)
    private readonly servicios: ServiciosConfig,
  ) {}


  notificar(tipo: string, email: string, datos: Record<string, unknown>): void {
    axios
      .post(
        `${this.servicios.notificaciones}/interno/notificar`,
        { tipo, email, datos },
        { timeout: 3000 },
      )
      .then(() => {
        this.logger.log(`Notificación "${tipo}" enviada`);
      })
      .catch((error: unknown) => {
        const detalle = error instanceof Error ? error.message : 'desconocido';

        // Se registra como advertencia y NO como error: que no salga un aviso
        // no es una falla del sistema, es un aviso perdido.
        this.logger.warn(
          `No se pudo enviar la notificación "${tipo}": ${detalle}. ` +
            `La orden no se ve afectada.`,
        );
      });
  }
}
