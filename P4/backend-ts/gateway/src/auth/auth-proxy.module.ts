import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { serviciosConfig } from '../config/servicios.config';
import { AuthClienteService } from './auth-cliente.service';
import { AuthProxyController } from './auth-proxy.controller';
import { SesionGuard } from './sesion.guard';

@Module({
  imports: [ConfigModule.forFeature(serviciosConfig)],
  controllers: [AuthProxyController],
  providers: [AuthClienteService, SesionGuard],

  // Se exportan porque en las siguientes fases los módulos de Productos y
  // Órdenes van a necesitar el mismo guard para proteger sus rutas GraphQL.
  exports: [AuthClienteService, SesionGuard],
})
export class AuthProxyModule {}
