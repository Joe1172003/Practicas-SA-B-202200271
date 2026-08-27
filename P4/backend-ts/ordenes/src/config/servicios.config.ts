import { registerAs } from '@nestjs/config';

/**
 * Con quien habla Ordenes.
 *
 * Fijate que NO hay una URL de la base de datos de Productos: la unica forma
 * que tiene este servicio de saber algo del catalogo es por HTTP. Esa es la
 * regla mas importante del diseño y aqui queda evidente.
 *
 * CAMBIO DE LA P5: las dos direcciones ya no son del mismo tipo, y esa
 * diferencia es el corazon de la practica.
 *
 *   productos  -> una URL HTTP. La saga necesita ESPERAR la respuesta para
 *                 saber si hay stock, asi que sigue siendo sincrona.
 *   rabbitmq   -> una cola. El aviso de orden pagada o cancelada se deja y
 *                 se sigue, porque nadie depende de esa respuesta.
 */
export interface ServiciosConfig {
  productos: string;
  rabbitmqUrl: string;
  colaNotificaciones: string;
}

export const serviciosConfig = registerAs('servicios', (): ServiciosConfig => ({
  productos: process.env.URL_PRODUCTOS as string,
  rabbitmqUrl: process.env.RABBITMQ_URL as string,
  colaNotificaciones: process.env.COLA_NOTIFICACIONES as string,
}));
