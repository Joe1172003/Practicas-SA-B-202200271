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
 * CAMBIO DE LA P5: antes esto hacia un POST directo al microservicio de
 * Notificaciones. Si ese servicio estaba caido, el aviso se perdia.
 *
 * Ahora Auth deja el mensaje en una cola y se olvida. Si el consumidor esta
 * apagado, el mensaje espera ahi hasta que vuelva.
 *
 * Fijate que el metodo notificar() tiene la misma firma de siempre: por eso
 * auth.service.ts no cambio ni una linea.
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

  /**
   * Abre la conexion con el broker y deja lista la cola.
   *
   * Si falla, NO tumba el arranque de Auth: registrar usuarios tiene que
   * seguir funcionando aunque el broker no este. Se reintenta al publicar.
   */
  private async conectar(): Promise<void> {
    try {
      this.conexion = await amqp.connect(this.servicios.rabbitmqUrl);
      this.canal = await this.conexion.createChannel();

      // durable: true hace que la cola sobreviva a un reinicio del broker.
      // Sin esto, los mensajes acumulados se perderian.
      await this.canal.assertQueue(this.servicios.colaNotificaciones, {
        durable: true,
      });

      // Si la conexion se cae despues, se limpia para que el siguiente
      // notificar() intente reconectar.
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
   * Deja un aviso en la cola. No espera a que nadie lo lea.
   *
   * Sigue siendo void y sin await por la misma razon de siempre: la cuenta
   * ya se creo, y que el aviso falle no debe deshacer el registro.
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
            `La cuenta se creo igual.`,
        );
        return;
      }

      this.canal.sendToQueue(
        this.servicios.colaNotificaciones,
        Buffer.from(JSON.stringify({ tipo, email, datos })),

        // persistent: true le dice a RabbitMQ que escriba el mensaje en
        // disco. Es la otra mitad de la durabilidad: una cola durable con
        // mensajes no persistentes igual perderia el contenido.
        { persistent: true },
      );

      this.logger.log(`Aviso "${tipo}" publicado en la cola`);
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'desconocido';
      this.logger.warn(
        `No se pudo publicar el aviso "${tipo}": ${detalle}. ` +
          `La cuenta se creo igual.`,
      );
    }
  }
}
