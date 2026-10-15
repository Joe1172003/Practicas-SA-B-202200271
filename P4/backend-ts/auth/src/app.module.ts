import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { appConfig } from './config/app.config';
import { cookieConfig } from './config/cookie.config';
import { cryptoConfig } from './config/crypto.config';
import { databaseConfig } from './config/database.config';
import type { DatabaseConfig } from './config/database.config';
import { envValidationSchema } from './config/env.validation';
import { jwtConfig } from './config/jwt.config';
import { serviciosConfig } from './config/servicios.config';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { LoggerModule } from 'nestjs-pino';
import { configRegistros } from './registros';

@Module({
  imports: [
    // Logs en JSON con el trace_id de cada peticion (registros.ts).
    LoggerModule.forRoot(configRegistros),

    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        cookieConfig,
        cryptoConfig,
        serviciosConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: {abortEarly: false},
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule.forFeature(databaseConfig)],
      inject: [databaseConfig.KEY],
      useFactory: (config: DatabaseConfig) => ({
        type: 'postgres' as const,
        url: config.url,
        autoLoadEntities: true,

        // Con true, TypeORM crea la tabla `users` al arrancar leyendo la entidad User
        synchronize: config.synchronize,

        ssl: false,

        // P10: el pool de pg cerraba las conexiones ociosas a los 10 s. Con poco
        // trafico por Pod, casi cada peticion abria una conexion nueva y pagaba
        // ~100 ms de handshake y autenticacion SCRAM, contra 20-40 ms de la
        // consulta (lo mostro Tempo en el canary de la v2.4.1). Ahora la
        // conexion sobrevive 5 min entre peticiones. max 5: con 3 servicios y
        // hasta 3 Pods cada uno son 45 como mucho, lejos del limite de 100.
        extra: {
          max: 5,
          idleTimeoutMillis: 300000,
        },
      }),
    }),

    UsersModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
