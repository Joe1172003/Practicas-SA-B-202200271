import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthProxyModule } from './auth/auth-proxy.module';
import { appConfig } from './config/app.config';
import { envValidationSchema } from './config/env.validation';
import { serviciosConfig } from './config/servicios.config';
import { GraphqlProxyModule } from './graphql-proxy/graphql-proxy.module';
import { HealthModule } from './health/health.module';

/**
 * El gateway no tiene base de datos ni entidades: no es dueño de ningún dato.
 * Su único trabajo es recibir peticiones del exterior y repartirlas a los
 * microservicios que sí tienen los datos.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, serviciosConfig],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),

    AuthProxyModule,
    GraphqlProxyModule,
    HealthModule,
  ],
})
export class AppModule {}
