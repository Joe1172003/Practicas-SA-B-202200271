import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  synchronize: boolean;
}

/**
 * Conexión a db_ordenes. Este servicio SOLO conoce esta URL: no tiene forma
 * de conectarse a db_auth ni a db_productos aunque quisiera. Así el patrón
 * "database per service" no depende de la disciplina del programador.
 */
export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  url: process.env.DATABASE_URL as string,
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
}));
