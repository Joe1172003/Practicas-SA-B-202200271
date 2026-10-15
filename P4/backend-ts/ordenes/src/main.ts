// Primero que todo: OpenTelemetry tiene que envolver las librerias antes de
// que Nest las cargue (ver telemetria.ts).
import './telemetria';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
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

  // Este servicio también valida lo que recibe, aunque el gateway ya haya
  // validado antes. Un microservicio no da por hecho que quien lo llama hizo
  // bien su trabajo.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Sin CORS: a este servicio solo lo llama el gateway, y las llamadas entre
  // servidores no pasan por la política de CORS.

  await app.listen(config.port, '0.0.0.0');

  logger.log(`Microservicio de ÓRDENES escuchando en el puerto ${config.port}`);
  logger.log(`GraphQL disponible en /graphql`);
}

void bootstrap();
