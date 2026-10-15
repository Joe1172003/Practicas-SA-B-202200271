// Primero que todo: OpenTelemetry tiene que envolver las librerias antes de
// que Nest las cargue (ver telemetria.ts).
import './telemetria';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { marcarVersion } from './common/version.middleware';
import { appConfig } from './config/app.config';
import type { AppConfig } from './config/app.config';
import { Logger } from 'nestjs-pino';

/**
 * Arranque del API Gateway.
 *
 * Aquí viven las tres cosas que el patrón API Gateway centraliza y que por eso
 * NO se repiten en los demás microservicios: el parseo de la cookie, la
 * validación de los DTOs y la política de CORS.
 */
async function bootstrap() {
  // bufferLogs: lo que Nest escriba al arrancar espera a que exista el logger JSON.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get<AppConfig>(appConfig.KEY);

  // Necesario para poder leer la cookie con el JWT que manda el navegador.
  app.use(cookieParser());

  // Cada respuesta dice que version del gateway la atendio (se ve en el canary).
  app.use(marcarVersion);


  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS solo se configura aquí porque el gateway es el único servicio que
  // habla con un navegador.
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    exposedHeaders: ['X-Token-Renovado', 'X-Version-Gateway'],
  });

  // 0.0.0.0 para aceptar tráfico que viene de fuera del contenedor.
  await app.listen(config.port, '0.0.0.0');

  logger.log(`API GATEWAY escuchando en el puerto ${config.port}`);
}

void bootstrap();
