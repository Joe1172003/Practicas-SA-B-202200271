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

@Module({
  imports: [

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
      }),
    }),

    UsersModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
