import { registerAs } from '@nestjs/config';

/**
 * Los dos microservicios con los que habla Órdenes durante la saga.
 *
 * Fijate que NO hay una URL de la base de datos de Productos: la única forma
 * que tiene este servicio de saber algo del catálogo es por HTTP. Esa es la
 * regla más importante del diseño y aquí queda evidente.
 */
export interface ServiciosConfig {
  productos: string;
  notificaciones: string;
}

export const serviciosConfig = registerAs('servicios', (): ServiciosConfig => ({
  productos: process.env.URL_PRODUCTOS as string,
  notificaciones: process.env.URL_NOTIFICACIONES as string,
}));
