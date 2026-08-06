import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  corsOrigins: string[];
  isProduction: boolean;
}


export const appConfig = registerAs('app', (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV as 'development' | 'production' | 'test',
  port: Number(process.env.PORT),

  corsOrigins: (process.env.CORS_ORIGIN as string)
    .split(',')
    .map((origen) => origen.trim())
    .filter((origen) => origen.length > 0),

  isProduction: process.env.NODE_ENV === 'production',
}));
