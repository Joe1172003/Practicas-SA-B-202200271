import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  synchronize: boolean;
}

/**
 * Conexión a la base de datos (Neon PostgreSQL).
 *
 * `synchronize` le dice a TypeORM que compare las entidades de TypeScript
 * contra las tablas reales y ejecute los CREATE/ALTER necesarios al arrancar.
 * Es cómodo en desarrollo porque nunca escribimos SQL a mano, pero en
 * producción es peligroso: un cambio en una entidad podría borrar una columna
 * con datos. Por eso el valor por defecto es false y se activa solo en el .env
 * de desarrollo.
 */
export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  url: process.env.DATABASE_URL as string,
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
}));
