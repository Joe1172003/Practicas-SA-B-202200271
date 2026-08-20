import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import type { AppConfig } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get<AppConfig>(appConfig.KEY);

  // Este servicio también valida lo que recibe, aunque el gateway ya haya
  // validado antes. Un microservicio no da por hecho que quien lo llama hizo
  // bien su trabajo: Órdenes le pega directo a /interno sin pasar por el
  // gateway, así que esta es la única validación que ven esos endpoints.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Sin CORS: a este servicio no lo llama ningún navegador, solo el gateway y
  // el microservicio de Órdenes, y las llamadas entre servidores no pasan por
  // la política de CORS.

  await app.listen(config.port, '0.0.0.0');

  console.log(`Microservicio de PRODUCTOS escuchando en el puerto ${config.port}`);
  console.log(`GraphQL disponible en /graphql`);
}

void bootstrap();
