import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { serviciosConfig } from '../config/servicios.config';
import type { ServiciosConfig } from '../config/servicios.config';

/**
 * Publica avisos en RabbitMQ.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * LA PREGUNTA CLAVE DE LA PRACTICA, AHORA MAS CLARA QUE NUNCA:
 *
 *   ¿Por que apartar stock SI espera respuesta y notificar NO?
 *
 *   - Apartar stock CAMBIA LA DECISION. Segun lo que conteste Productos, la
 *     orden sigue o se rechaza. Por eso ProductosCliente usa HTTP y espera.
 *
 *   - Notificar NO CAMBIA NADA. La orden ya esta pagada, el stock ya se
 *     descarto, el negocio ya ocurrio. Es un aviso, no un paso.
 *
 * En la P4 esa diferencia se veia en que uno tenia await y el otro no. En la
 * P5 se ve en que son tecnologias distintas: uno es una llamada HTTP, el
 * otro es dejar una carta en un buzon.
 * ═══════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class NotificacionesCliente implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificacionesCliente.name);

  private conexion: amqp.ChannelModel | null = null;
  private canal: amqp.Channel | null = null;

  constructor(
    @Inject(serviciosConfig.KEY)
    private readonly servicios: ServiciosConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.conectar();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.canal?.close();
      await this.conexion?.close();
    } catch {
      // Si ya estaba cerrada, no hay nada que hacer.
    }
  }

  private async conectar(): Promise<void> {
    try {
      this.conexion = await amqp.connect(this.servicios.rabbitmqUrl);
      this.canal = await this.conexion.createChannel();

      // durable: true hace que la cola sobreviva a un reinicio del broker.
      await this.canal.assertQueue(this.servicios.colaNotificaciones, {
        durable: true,
      });

      this.conexion.on('close', () => {
        this.logger.warn('Se cerro la conexion con RabbitMQ');
        this.canal = null;
        this.conexion = null;
      });

      this.logger.log('Conectado a RabbitMQ');
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'desconocido';
      this.logger.warn(`No se pudo conectar a RabbitMQ: ${detalle}`);
      this.canal = null;
      this.conexion = null;
    }
  }

  /**
   * Deja un aviso en la cola sin esperar a que nadie lo lea.
   *
   * Sigue siendo void, igual que en la P4: si esto falla, la orden pagada
   * sigue siendo valida y no se deshace nada.
   */
  notificar(tipo: string, email: string, datos: Record<string, unknown>): void {
    void this.publicar(tipo, email, datos);
  }

  private async publicar(
    tipo: string,
    email: string,
    datos: Record<string, unknown>,
  ): Promise<void> {
    try {
      if (!this.canal) {
        await this.conectar();
      }

      if (!this.canal) {
        this.logger.warn(
          `Sin conexion al broker: el aviso "${tipo}" no se publico. ` +
            `La orden no se ve afectada.`,
        );
        return;
      }

      this.canal.sendToQueue(
        this.servicios.colaNotificaciones,
        Buffer.from(JSON.stringify({ tipo, email, datos })),

        // persistent: true escribe el mensaje en disco. Es la otra mitad de
        // la durabilidad: una cola durable con mensajes no persistentes
        // igual perderia el contenido al reiniciar el broker.
        { persistent: true },
      );

      this.logger.log(`Aviso "${tipo}" publicado en la cola`);
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'desconocido';
      this.logger.warn(
        `No se pudo publicar el aviso "${tipo}": ${detalle}. ` +
          `La orden no se ve afectada.`,
      );
    }
  }
}
