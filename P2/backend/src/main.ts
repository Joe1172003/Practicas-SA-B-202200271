import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import type { AppConfig } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(config.port);

  console.log(`API escuchando en http://localhost:${config.port}`);
  console.log(`Frontend autorizado cors: ${config.corsOrigins.join(', ')}`);
}

void bootstrap();
