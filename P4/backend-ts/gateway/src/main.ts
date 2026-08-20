import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import type { AppConfig } from './config/app.config';

/**
 * Arranque del API Gateway.
 *
 * Aquí viven las tres cosas que el patrón API Gateway centraliza y que por eso
 * NO se repiten en los demás microservicios: el parseo de la cookie, la
 * validación de los DTOs y la política de CORS.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get<AppConfig>(appConfig.KEY);

  // Necesario para poder leer la cookie con el JWT que manda el navegador.
  app.use(cookieParser());


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
    exposedHeaders: ['X-Token-Renovado'],
  });

  // 0.0.0.0 para aceptar tráfico que viene de fuera del contenedor.
  await app.listen(config.port, '0.0.0.0');

  console.log(`API GATEWAY escuchando en el puerto ${config.port}`);
}

void bootstrap();
