import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { serviciosConfig } from '../config/servicios.config';
import type { ServiciosConfig } from '../config/servicios.config';

// el microservicio de ordenes invoca mediante axios los tres servicios internos
// del microservicio apartar, liberar, confirmar venta

/** Lo que Órdenes le manda a Productos: qué producto y cuántas unidades. */
export interface LineaDeMovimiento {
  productoId: string;
  cantidad: number;
}

/** Lo que Productos devuelve cuando aparta bien: con nombre y precio del momento. */
export interface LineaApartada {
  productoId: string;
  nombreProducto: string;
  precioUnitario: number;
  cantidad: number;
}

export type ResultadoDeApartado =
  | { ok: true; lineas: LineaApartada[] }
  | { ok: false; motivo: string };

/**
 * Todas las llamadas de Órdenes hacia Productos.
 *
 * Este archivo ES la frontera entre los dos microservicios. Órdenes no importa
 * ni una sola entidad de Productos ni conoce su base de datos: lo único que
 * comparten son estas tres formas de JSON que viajan por HTTP.
 */
@Injectable()
export class ProductosCliente {
  private readonly logger = new Logger(ProductosCliente.name);

  constructor(
    @Inject(serviciosConfig.KEY)
    private readonly servicios: ServiciosConfig,
  ) {}

  /**
   * Esta llamada SÍ espera respuesta, y no es negociable.
   *
   * ¿Por qué esperar? Porque el siguiente paso depende del resultado: si no hay
   * stock, la orden se rechaza y no hay nada más que hacer. No se puede seguir
   * adelante "por si acaso" y averiguar después: se habría cobrado una orden
   * que no se puede despachar.
   *
   * Si la llamada falla por RED (Productos caído, timeout), se devuelve
   * ok:false con el motivo. Para quien llama es lo mismo que no haber stock:
   * en los dos casos no se apartó nada y la orden no puede continuar.
   */
  async apartarStock(ordenId: string, lineas: LineaDeMovimiento[]): Promise<ResultadoDeApartado> {
    try {
      const respuesta = await axios.post<ResultadoDeApartado>(
        `${this.servicios.productos}/interno/apartar-stock`,
        { ordenId, lineas },
        { timeout: 5000 },
      );

      return respuesta.data;
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'desconocido';
      this.logger.error(`Falló apartar-stock de la orden ${ordenId}: ${detalle}`);

      return {
        ok: false,
        motivo: 'No se pudo reservar el inventario en este momento',
      };
    }
  }

  /**
   * COMPENSACIÓN DE LA SAGA. Devuelve al catálogo el stock que se había
   * apartado. Se llama al cancelar una orden.
   *
   * Devuelve true o false en vez de lanzar una excepción: quien llama ya está
   * en medio de cancelar una orden y no puede permitirse que la compensación
   * lo tumbe. Si esto falla, la orden igual se cancela y queda el registro en
   * el log.
   */
  async liberarStock( ordenId: string, lineas: LineaDeMovimiento[]): Promise<boolean> {
    try {
      await axios.post(
        `${this.servicios.productos}/interno/liberar-stock`,
        { ordenId, lineas },
        { timeout: 5000 },
      );

      this.logger.log(`Compensación aplicada: stock liberado de la orden ${ordenId}`);
      return true;
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'desconocido';

      // el stock quedó apartado en Productos para una orden que ya no existe.
      // No hay forma automática de arreglarlo desde aquí (si Productos está
      // caído, reintentar tampoco funcionaría). En un sistema real esto
      // dispararía una alerta y habría un proceso que revisa periódicamente
      // las órdenes canceladas cuyo stock nunca se liberó.
      this.logger.error(
        `¡COMPENSACIÓN FALLIDA! La orden ${ordenId} se canceló pero su stock ` +
          `NO se pudo liberar: ${detalle}. Requiere revisión manual.`,
      );
      return false;
    }
  }

  /**
   * PASO FINAL DE LA SAGA: el pago entró, la mercadería sale de bodega.
   * Se espera respuesta porque si esto falla hay que cancelar y compensar.
   */
  async confirmarVenta(
    ordenId: string,
    lineas: LineaDeMovimiento[],
  ): Promise<boolean> {
    try {
      await axios.post(
        `${this.servicios.productos}/interno/confirmar-venta`,
        { ordenId, lineas },
        { timeout: 5000 },
      );

      return true;
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'desconocido';
      this.logger.error(
        `Falló confirmar-venta de la orden ${ordenId}: ${detalle}`,
      );
      return false;
    }
  }
}
