import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificacionesCliente } from '../clientes/notificaciones.cliente';
import { ProductosCliente } from '../clientes/productos.cliente';
import { serviciosConfig } from '../config/servicios.config';
import { LineaOrden } from './linea-orden.entity';
import { Orden } from './orden.entity';
import { OrdenesResolver } from './ordenes.resolver';
import { OrdenesService } from './ordenes.service';
import { SagaService } from './saga.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Orden, LineaOrden]),

    // Los clientes HTTP necesitan las URLs de Productos y Notificaciones.
    ConfigModule.forFeature(serviciosConfig),
  ],
  providers: [
    OrdenesService,
    SagaService,
    OrdenesResolver,
    ProductosCliente,
    NotificacionesCliente,
  ],
})
export class OrdenesModule {}
