// Primero que todo: OpenTelemetry tiene que envolver las librerias antes de
// que Nest las cargue (ver telemetria.ts).
import './telemetria';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import type { AppConfig } from './config/app.config';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  // bufferLogs: lo que Nest escriba al arrancar espera a que exista el logger JSON.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get<AppConfig>(appConfig.KEY);

  // Configuración de cookies para la sesión.
  app.use(cookieParser());

  // Configuración global de validación de DTOs. Con `whitelist: true` se
  // eliminan del objeto final las propiedades que no estén en el DTO, y con
  // `forbidNonWhitelisted: true` se lanza un error si el cliente envía
  // propiedades que no están en el DTO.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );


  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    exposedHeaders: ['X-Token-Renovado'],
  });

  // ahora la app escucha en todas las interfaces de red, y el gateway puede alcanzarla
  await app.listen(config.port, '0.0.0.0');

  logger.log(`Microservicio de autenticación escuchando en el puerto ${config.port}`);
  logger.log(`Origenes autorizados por cors: ${config.corsOrigins.join(', ')}`);
}

void bootstrap();
