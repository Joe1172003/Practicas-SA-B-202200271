import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthProxyModule } from '../auth/auth-proxy.module';
import { serviciosConfig } from '../config/servicios.config';
import { NotificacionesClienteService } from './notificaciones-cliente.service';
import { NotificacionesProxyController } from './notificaciones-proxy.controller';

/**
 * Importa AuthProxyModule porque el controlador usa SesionGuard, que se declara
 * y exporta allá.
 */
@Module({
  imports: [ConfigModule.forFeature(serviciosConfig), AuthProxyModule],
  controllers: [NotificacionesProxyController],
  providers: [NotificacionesClienteService],
})
export class NotificacionesProxyModule {}