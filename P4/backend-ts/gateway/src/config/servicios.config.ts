import { registerAs } from '@nestjs/config';

/**
 * Direcciones de los microservicios que el gateway consume.
 *
 * Son URLs completas y vienen del .env, nunca quemadas en el código. Los
 * nombres de host (auth, productos, ordenes, notificaciones) son los nombres de
 * los servicios en docker-compose.yml: Docker tiene un DNS interno que los
 * traduce a la IP del contenedor. Por eso el gateway no necesita saber en qué
 * IP quedó cada uno.
 */
export interface ServiciosConfig {
  auth: string;
  productos: string;
  ordenes: string;
  notificaciones: string;
}

export const serviciosConfig = registerAs(
  'servicios',
  (): ServiciosConfig => ({
    auth: process.env.URL_AUTH as string,
    productos: process.env.URL_PRODUCTOS as string,
    ordenes: process.env.URL_ORDENES as string,
    notificaciones: process.env.URL_NOTIFICACIONES as string,
  }),
);
