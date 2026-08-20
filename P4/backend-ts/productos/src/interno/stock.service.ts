import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LineaDeMovimientoDto } from './dto/movimiento-stock.dto';

/** Lo que Productos le devuelve a Órdenes cuando aparta stock con éxito. */
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
 * Movimientos de stock. Es la parte de Productos que participa en la SAGA.
 *
 * Los tres métodos son los tres pasos que puede pedir Órdenes:
 *   apartar   -> comprometer stock mientras la orden está pendiente
 *   liberar   -> compensación: deshacer el apartado si la orden se cancela
 *   confirmar -> el stock apartado se vendió de verdad
 */
@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(private readonly dataSource: DataSource) {}

  // o se aparta todas las lineas "productos" o no se aparta nada 
  async apartar( lineas: LineaDeMovimientoDto[], ordenId?: string ): Promise<ResultadoDeApartado> {
    try {
      const apartadas = await this.dataSource.transaction(async (manager) => {
        const resultado: LineaApartada[] = [];

        for (const linea of lineas) {
          // apatamos los productos comprados 
          const [filas, cantidadAfectada] = (await manager.query(
            `UPDATE productos
                SET stock_disponible = stock_disponible - $1,
                    stock_apartado   = stock_apartado   + $1
              WHERE id = $2
                AND stock_disponible >= $1
           RETURNING nombre, precio`,
            [linea.cantidad, linea.productoId],
          )) as [Array<{ nombre: string; precio: string }>, number];

          // Cero filas afectadas significa que el producto no existe o que no
          // había stock suficiente. Se lanza para que la transacción haga
          // ROLLBACK y se deshaga lo que ya se había apartado en esta misma
          // llamada.
          if (cantidadAfectada === 0) {
            throw new Error(await this.explicarFallo(manager, linea));
          }

          resultado.push({
            productoId: linea.productoId,
            nombreProducto: filas[0].nombre,
            precioUnitario: Number(filas[0].precio),
            cantidad: linea.cantidad,
          });
        }

        return resultado;
      });

      this.logger.log(
        `Stock apartado para la orden ${ordenId ?? '(sin id)'}: ${apartadas.length} línea(s)`,
      );

      return { ok: true, lineas: apartadas };
    } catch (error) {
      const motivo = error instanceof Error ? error.message : 'error desconocido';

      this.logger.warn(
        `No se pudo apartar stock para la orden ${ordenId ?? '(sin id)'}: ${motivo}`,
      );

      // Se responde 200 con ok:false y no un error HTTP. Quedarse sin stock no
      // es una falla del servicio: es una respuesta de negocio perfectamente
      // normal, y Órdenes tiene que poder distinguirla de "Productos se cayó".
      return { ok: false, motivo };
    }
  }

  /**
   * COMPENSACIÓN DE LA SAGA: devuelve al stock disponible lo que se había
   * apartado. Lo llama Órdenes cuando una orden se cancela o cuando el pago
   * falla.
   *
   * No existe un ROLLBACK que abarque la base de Órdenes y la de Productos al
   * mismo tiempo, porque son bases distintas. Esta operación ES el rollback:
   * una segunda transacción que deshace la primera.
   */
  async liberar( lineas: LineaDeMovimientoDto[], ordenId?: string ): Promise<{ ok: boolean }> {
    await this.dataSource.transaction(async (manager) => {
      for (const linea of lineas) {
        
        await manager.query(
          `UPDATE productos
              SET stock_disponible = stock_disponible + $1,
                  stock_apartado   = GREATEST(stock_apartado - $1, 0)
            WHERE id = $2`,
          [linea.cantidad, linea.productoId],
        );
      }
    });

    this.logger.log(
      `Stock liberado (compensación) de la orden ${ordenId ?? '(sin id)'}`,
    );

    return { ok: true };
  }

  /**
   * PASO FINAL DE LA SAGA: el pago se confirmó, la mercadería sale de bodega.
   *
   * Solo baja el stock apartado. El disponible NO se toca porque ya se le había
   * restado al apartar: si lo restáramos otra vez, estaríamos descontando dos
   * veces el mismo producto.
   */
  async confirmarVenta( lineas: LineaDeMovimientoDto[], ordenId?: string ): Promise<{ ok: boolean }> {
    await this.dataSource.transaction(async (manager) => {
      for (const linea of lineas) {
        await manager.query(
          `UPDATE productos
              SET stock_apartado = GREATEST(stock_apartado - $1, 0)
            WHERE id = $2`,
          [linea.cantidad, linea.productoId],
        );
      }
    });

    this.logger.log(`Venta confirmada de la orden ${ordenId ?? '(sin id)'}`);

    return { ok: true };
  }

  /** Arma un mensaje entendible cuando el apartado falla. */
  private async explicarFallo( manager: { query: (sql: string, params: unknown[]) => Promise<unknown[]> }, linea: LineaDeMovimientoDto ): Promise<string> {
    const filas = (await manager.query(
      'SELECT nombre, stock_disponible FROM productos WHERE id = $1',
      [linea.productoId],
    )) as Array<{ nombre: string; stock_disponible: number }>;

    if (filas.length === 0) {
      return `El producto ${linea.productoId} no existe`;
    }

    return `Stock insuficiente de "${filas[0].nombre}": se pidieron ${linea.cantidad} y solo hay ${filas[0].stock_disponible}`;
  }
}
