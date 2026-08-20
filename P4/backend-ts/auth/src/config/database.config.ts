import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  synchronize: boolean;
}


export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  url: process.env.DATABASE_URL as string,
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
}));
