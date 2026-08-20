import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ProductosCliente } from '../clientes/productos.cliente';
import { CrearOrdenInput } from './dto/crear-orden.input';
import { EstadoOrden } from './estado-orden.enum';
import { LineaOrden } from './linea-orden.entity';
import { Orden } from './orden.entity';

const VIOLACION_UNIQUE = '23505';

/**
 * Consultas y creación de órdenes.
 *
 * Los pasos que siguen a la creación (pagar, cancelar) viven en SagaService,
 */
@Injectable()
export class OrdenesService {
  private readonly logger = new Logger(OrdenesService.name);

  constructor( @InjectRepository(Orden) private readonly ordenes: Repository<Orden>, private readonly productos: ProductosCliente) {}

  async misOrdenes(usuarioId: string): Promise<Orden[]> {
    return this.ordenes.find({
      where: { usuarioId },
      order: { fecha: 'DESC' },
    });
  }

  /**
   * Busca una orden, pero solo si es del usuario que pregunta.
   *
   * El `usuarioId` va dentro del where y no en un `if` después de leerla. Así
   * es imposible que un cliente vea la orden de otro adivinando su id: para la
   * consulta, esa orden simplemente no existe.
   */
  async buscarOrden(id: string, usuarioId: string): Promise<Orden | null> {
    return this.ordenes.findOne({ where: { id, usuarioId } });
  }

  /** Igual que buscarOrden pero lanza si no existe. Lo usa la saga. */
  async obtenerOrden(id: string, usuarioId: string): Promise<Orden> {
    const orden = await this.buscarOrden(id, usuarioId);

    if (!orden) {
      throw new NotFoundException('La orden no existe');
    }

    return orden;
  }

  
  /**
   * Servicio de crear ORDEN
   * PASOS 1 Y 2 DE LA SAGA: crear la orden y apartar el stock.
   *
   *   0. Idempotencia: si esta clave ya se usó, devolver la orden de antes.
   *   1. Guardar la orden en estado PENDIENTE.
   *   2. Pedirle a Productos que aparte el stock.
   *        falla -> la orden queda RECHAZADA y se acaba
   *        ok    -> se copian nombre y precio en las líneas, sigue PENDIENTE
   *
   * La orden se guarda ANTES de llamar a Productos a propósito. Si se guardara
   * después, una caída justo en medio dejaría stock apartado en Productos sin
   * ninguna orden que lo explique, y nadie sabría que hay que liberarlo.
   * Guardándola primero, siempre queda rastro de lo que se intentó.
   */
  async crearOrden(usuarioId: string, input: CrearOrdenInput): Promise<Orden> {
    // paso 0: la indempotencia
    const yaExiste = await this.ordenes.findOneBy({
      claveIdempotencia: input.claveIdempotencia,
    });

    if (yaExiste) {
      this.logger.log(
        `Clave de idempotencia repetida: se devuelve la orden ${yaExiste.id} sin crear otra`,
      );
      return yaExiste;
    }

    // Paso 1: la orden nace PENDIENTE, vacía y en cero 
    let orden = this.ordenes.create({
      usuarioId,
      estado: EstadoOrden.PENDIENTE,
      total: 0,
      claveIdempotencia: input.claveIdempotencia,
      motivo: null,
      lineas: [],
    });

    try {
      orden = await this.ordenes.save(orden);
    } catch (error) {
      // Dos peticiones idénticas a la vez: las dos pasaron el findOneBy de
      // arriba y las dos intentaron insertar. La base rechaza la segunda por el
      // índice UNIQUE. Aquí se atrapa ese choque y se devuelve la que ganó.
      if (this.esClaveRepetida(error)) {
        const ganadora = await this.ordenes.findOneBy({
          claveIdempotencia: input.claveIdempotencia,
        });

        if (ganadora) {
          this.logger.log(
            `Carrera de idempotencia resuelta: se devuelve la orden ${ganadora.id}`,
          );
          return ganadora;
        }
      }
      throw error;
    }

    // Paso 2: apartar el stock
    const resultado = await this.productos.apartarStock(orden.id, input.lineas);

    if (!resultado.ok) {
      // No se apartó nada, así que NO hay nada que compensar. La orden muere
      // aquí, en estado RECHAZADA, con el motivo escrito para poder explicarlo.
      orden.estado = EstadoOrden.RECHAZADA;
      orden.motivo = resultado.motivo;

      this.logger.warn(`Orden ${orden.id} RECHAZADA: ${resultado.motivo}`);

      return this.ordenes.save(orden);
    }

    // Stock apartado. Ahora sí se arman las líneas COPIANDO el nombre y el
    // precio que Productos acaba de devolver. Ese precio queda congelado para
    // siempre en esta orden.
    orden.lineas = resultado.lineas.map((apartada) => {
      const linea = new LineaOrden();
      linea.productoId = apartada.productoId;
      linea.nombreProducto = apartada.nombreProducto;
      linea.precioUnitario = apartada.precioUnitario;
      linea.cantidad = apartada.cantidad;
      return linea;
    });

    orden.total = orden.lineas.reduce(
      (suma, linea) => suma + linea.precioUnitario * linea.cantidad,
      0,
    );

    this.logger.log(
      `Orden ${orden.id} PENDIENTE con ${orden.lineas.length} línea(s), total Q${orden.total}`,
    );

    return this.ordenes.save(orden);
  }

  private esClaveRepetida(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string })?.code === VIOLACION_UNIQUE
    );
  }
}
