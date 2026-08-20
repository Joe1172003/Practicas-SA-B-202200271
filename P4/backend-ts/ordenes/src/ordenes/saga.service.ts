import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificacionesCliente } from '../clientes/notificaciones.cliente';
import { ProductosCliente } from '../clientes/productos.cliente';
import { EstadoOrden } from './estado-orden.enum';
import { Orden } from './orden.entity';
import { OrdenesService } from './ordenes.service';

/**
 * LOS PASOS FINALES DE LA SAGA: pagar y cancelar.
 *
 * Una saga existe porque NO hay forma de hacer un ROLLBACK que abarque dos
 * bases de datos distintas. La orden vive en db_ordenes y el stock en
 * db_productos: son dos transacciones separadas que no se pueden unir.
 *
 * La solución es que cada paso tenga su paso contrario, y que alguien los vaya
 * llamando en orden. Ese "alguien" es este servicio: Órdenes COORDINA la saga
 * con llamadas HTTP normales.
 *
 *   apartar stock   <-->  liberar stock   (compensación)
 *   confirmar venta <-->  (no tiene, la venta es el final del camino)
 */
@Injectable()
export class SagaService {
  private readonly logger = new Logger(SagaService.name);

  constructor(
    @InjectRepository(Orden)
    private readonly ordenes: Repository<Orden>,
    private readonly ordenesService: OrdenesService,
    private readonly productos: ProductosCliente,
    private readonly notificaciones: NotificacionesCliente,
  ) {}

  /**
   * PASO 3 DE LA SAGA: confirmar el pago.
   *
   *   1. La orden debe estar PENDIENTE.
   *   2. Se cobra.
   *   3. Se le avisa a Productos que la venta es firme.
   *        falla -> la orden se CANCELA y se libera el stock (compensación)
   *        ok    -> la orden queda PAGADA
   *   4. Se manda el aviso a Notificaciones.
   */
  async confirmarPago(ordenId: string, usuarioId: string, correo: string): Promise<Orden> {
    const orden = await this.ordenesService.obtenerOrden(ordenId, usuarioId);

    // Solo una orden PENDIENTE se puede pagar. Si ya está PAGADA, volver a
    // llamar aquí cobraría dos veces; si está CANCELADA, su stock ya se liberó
    // y confirmar la venta descuadraría el inventario.
    this.exigirPendiente(orden, 'pagar');

    // pagar la orden
    this.logger.log(`Pago simulado aprobado para la orden ${orden.id}`);

    // Confirmar la venta en Productos
    const lineas = this.aLineasDeMovimiento(orden);
    const ventaConfirmada = await this.productos.confirmarVenta(orden.id, lineas);

    if (!ventaConfirmada) {
      // Productos no respondió. No se puede dar la orden por buena si no se
      // sabe si el inventario quedó bien, así que se deshace todo: la orden se
      // cancela y se intenta devolver el stock.
      this.logger.error(
        `No se pudo confirmar la venta de la orden ${orden.id}. Se cancela y se compensa.`,
      );

      return this.cancelarYCompensar(
        orden,
        correo,
        'No se pudo confirmar el inventario. La orden fue cancelada y no se te cobró.',
      );
    }

    orden.estado = EstadoOrden.PAGADA;
    const pagada = await this.ordenes.save(orden);

    // notificar la orden 
    this.notificaciones.notificar('orden_pagada', correo, {
      ordenId: pagada.id,
      total: pagada.total,
      lineas: pagada.lineas.length,
    });

    this.logger.log(`Orden ${pagada.id} PAGADA por Q${pagada.total}`);

    return pagada;
  }

  /**
   * CANCELACIÓN: el camino donde la compensación se ve claramente.
   *
   * La orden tenía stock apartado; al cancelar hay que devolverlo al catálogo,
   * porque si no ese stock quedaría bloqueado para siempre sin que nadie lo
   * compre.
   */
  async cancelarOrden(ordenId: string, usuarioId: string, correo: string): Promise<Orden> {
    const orden = await this.ordenesService.obtenerOrden(ordenId, usuarioId);

    this.exigirPendiente(orden, 'cancelar');

    return this.cancelarYCompensar(orden, correo, 'Cancelada por el cliente');
  }

  /**
   * El acto de compensar: marcar la orden como CANCELADA y devolver el stock.
   *
   * Se guarda la orden ANTES de llamar a Productos. Si se hiciera al revés y el
   * proceso muriera justo en medio, el stock estaría liberado pero la orden
   * seguiría diciendo PENDIENTE: alguien podría pagarla y el inventario
   * quedaría en negativo. Este orden es más seguro: en el peor caso queda una
   * orden cancelada con stock sin liberar, que es un problema visible y
   * arreglable, no una venta fantasma.
   */
  private async cancelarYCompensar( orden: Orden, correo: string, motivo: string): Promise<Orden> {
    orden.estado = EstadoOrden.CANCELADA;
    orden.motivo = motivo;

    const cancelada = await this.ordenes.save(orden);

    // LA COMPENSACIÓN. Devuelve el stock apartado al disponible.
    await this.productos.liberarStock(
      cancelada.id,
      this.aLineasDeMovimiento(cancelada),
    );

    // aviso de notificaciones
    this.notificaciones.notificar('orden_cancelada', correo, {
      ordenId: cancelada.id,
      motivo,
    });

    this.logger.log(`Orden ${cancelada.id} CANCELADA: ${motivo}`);

    return cancelada;
  }

  /** Traduce las líneas de la orden al formato que entiende Productos. */
  private aLineasDeMovimiento(orden: Orden) {
    return orden.lineas.map((linea) => ({
      productoId: linea.productoId,
      cantidad: linea.cantidad,
    }));
  }

  private exigirPendiente(orden: Orden, accion: string): void {
    if (orden.estado !== EstadoOrden.PENDIENTE) {
      throw new BadRequestException(
        `No se puede ${accion} una orden en estado ${orden.estado}`,
      );
    }
  }
}
