import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  corsOrigin: string;
  isProduction: boolean;
}

/**
 * Configuración general del servidor.
 *
 * `registerAs` crea un "espacio de nombres" de configuración. La ventaja frente
 * a leer process.env por todos lados es que cada clase pide exactamente el
 * bloque que necesita y lo recibe tipado, sin conocer los nombres de las
 * variables de entorno. Si mañana cambia un nombre, se cambia solo aquí.
 */
export const appConfig = registerAs('app', (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV as 'development' | 'production' | 'test',
  port: Number(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN as string,
  isProduction: process.env.NODE_ENV === 'production',
}));
