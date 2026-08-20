import { Inject, Injectable, Logger } from '@nestjs/common';
import { serviciosConfig } from '../config/servicios.config';
import type { ServiciosConfig } from '../config/servicios.config';


@Injectable()
export class NotificacionesCliente {
  private readonly logger = new Logger(NotificacionesCliente.name);

  constructor(
    @Inject(serviciosConfig.KEY)
    private readonly servicios: ServiciosConfig,
  ) {}

  notificar(tipo: string, email: string, datos: Record<string, unknown>): void {
    // notificar al microservicio de Notificaciones. Va sin await: la cuenta ya existe, 
    // y si el aviso falla no se debe deshacer el registro.
    fetch(`${this.servicios.notificaciones}/interno/notificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, email, datos }),
      signal: AbortSignal.timeout(3000),
    })
      .then(() => {
        this.logger.log(`Notificación "${tipo}" enviada`);
      })
      .catch((error: unknown) => {
        const detalle = error instanceof Error ? error.message : 'desconocido';

        // Advertencia y no error: perder un aviso no es una falla del sistema.
        this.logger.warn(
          `No se pudo enviar la notificación "${tipo}": ${detalle}. ` +
            `La cuenta se creó igual.`,
        );
      });
  }
}
