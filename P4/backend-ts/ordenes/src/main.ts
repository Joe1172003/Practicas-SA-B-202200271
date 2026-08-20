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

  console.log(`Microservicio de ÓRDENES escuchando en el puerto ${config.port}`);
  console.log(`GraphQL disponible en /graphql`);
}

void bootstrap();
