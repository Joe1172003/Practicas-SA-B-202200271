import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthProxyModule } from '../auth/auth-proxy.module';
import { serviciosConfig } from '../config/servicios.config';
import { GraphqlClienteService } from './graphql-cliente.service';
import { OrdenesProxyController } from './ordenes-proxy.controller';
import { ProductosProxyController } from './productos-proxy.controller';

/**
 * Enrutado de las consultas GraphQL hacia los microservicios que las tienen.
 *
 * Importa AuthProxyModule porque necesita AuthClienteService y SesionGuard para
 * resolver quién es el usuario de la cookie antes de reenviar.
 *
 * Los dos controladores tratan la sesión distinto y eso es a propósito:
 * el catálogo se puede ver sin iniciar sesión, las órdenes no.
 */
@Module({
  imports: [ConfigModule.forFeature(serviciosConfig), AuthProxyModule],
  controllers: [ProductosProxyController, OrdenesProxyController],
  providers: [GraphqlClienteService],
  exports: [GraphqlClienteService],
})
export class GraphqlProxyModule {}
