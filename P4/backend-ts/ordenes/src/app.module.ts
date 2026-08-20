import { ApolloDriver } from '@nestjs/apollo';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { OrdenesModule } from './ordenes/ordenes.module';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import type { DatabaseConfig } from './config/database.config';
import { envValidationSchema } from './config/env.validation';
import { serviciosConfig } from './config/servicios.config';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, serviciosConfig],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule.forFeature(databaseConfig)],
      inject: [databaseConfig.KEY],
      useFactory: (config: DatabaseConfig) => ({
        type: 'postgres' as const,
        url: config.url,
        autoLoadEntities: true,

        // Crea las tablas leyendo las entidades. En producción se usarían
        // migraciones, porque synchronize puede borrar una columna con datos.
        synchronize: config.synchronize,

        // Postgres vive en otro contenedor de la misma red privada de Docker:
        // el tráfico nunca sale de la máquina y no hay certificado TLS.
        ssl: false,
      }),
    }),

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,

      // Enfoque "code first": el esquema se genera en memoria leyendo los
      // decoradores de las entidades y del resolver. No se escribe ni se
      // mantiene un archivo .graphql a mano, así que nunca se desincroniza.
      autoSchemaFile: true,

      // Hace que el `req` de Express llegue al contexto de GraphQL. Sin esto,
      // SoloAdminGuard no podría leer el header x-usuario-rol que manda el
      // gateway.
      context: ({ req }: { req: unknown }) => ({ req }),

      // La pantalla interactiva para escribir consultas desde el navegador
      // (el sucesor del viejo GraphQL Playground). Se deja encendida porque
      // esto es un proyecto de práctica; en producción se apaga para no
      // publicar el esquema completo.
      playground: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault()],

      // Limpia el error antes de mandarlo al cliente.
      //
      // Por defecto Apollo mete el stacktrace completo del servidor dentro de
      // `extensions`. Eso revela rutas de archivos, versiones de librerías y la
      // estructura interna del proyecto: información que le sirve a un
      // atacante y a nadie más.
      //
      // De paso rescata los mensajes del ValidationPipe. Cuando falla una
      // validación, Nest lanza una excepción cuyo `message` es el texto
      // genérico "Bad Request Exception", y el detalle útil ("el precio tiene
      // que ser mayor a cero") queda escondido más adentro. Aquí se saca.
      formatError: (error) => {
        const original = error.extensions?.originalError as
          | { message?: string | string[]; statusCode?: number }
          | undefined;

        // Cuando son varios errores de validación, `message` es un arreglo.
        const detalle = Array.isArray(original?.message)
          ? original.message.join('. ')
          : original?.message;

        // Apollo traduce a códigos de GraphQL solo ALGUNAS excepciones de
        // Nest. NotFoundException no está entre ellas: sale como
        // INTERNAL_SERVER_ERROR, que le dice al cliente "el servidor se
        // rompió" cuando en realidad solo pidió algo que no existe.
        //
        // Se corrige traduciendo el código HTTP que la excepción original sí
        // trae. Si no es ninguno de estos, se respeta lo que dijo Apollo.
        const porEstadoHttp: Record<number, string> = {
          400: 'BAD_REQUEST',
          401: 'UNAUTHENTICATED',
          403: 'FORBIDDEN',
          404: 'NOT_FOUND',
          409: 'CONFLICT',
        };

        const codigo =
          (original?.statusCode
            ? porEstadoHttp[original.statusCode]
            : undefined) ?? error.extensions?.code;

        return {
          message: detalle ?? error.message,
          path: error.path,
          extensions: { code: codigo },
        };
      },
    }),

    OrdenesModule,
    HealthModule,
  ],
})
export class AppModule {}
