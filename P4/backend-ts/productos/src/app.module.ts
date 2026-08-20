import { ApolloDriver } from '@nestjs/apollo';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { CatalogoModule } from './catalogo/catalogo.module';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import type { DatabaseConfig } from './config/database.config';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
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

        // Crea las tablas leyendo las entidades. 
        synchronize: config.synchronize,

        ssl: false,
      }),
    }),

    // se levanta el servidor de GrapjQL
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,

      // Genera el esquema de GraphQL a partir de los decoradores @ObjectType, @Field, etc.
      // que se estan usando en las entidades
      autoSchemaFile: true,

      
      // Hace que el `req` de Express llegue al contexto de GraphQL. Sin esto,
      // SoloAdminGuard no podría leer el header x-usuario-rol que manda el
      // gateway.
      context: ({ req }: { req: unknown }) => ({ req }),

      // La pantalla interactiva para escribir consultas desde el navegador
      playground: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault()],

      // Limpia el error antes de mandarlo al cliente.
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

    CatalogoModule,
    HealthModule,
  ],
})
export class AppModule {}
