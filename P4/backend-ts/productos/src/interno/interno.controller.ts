import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { MovimientoDeStockDto } from './dto/movimiento-stock.dto';
import { StockService } from './stock.service';

/**
 * Endpoints REST internos. Solo los llama el microservicio de Órdenes; el
 * gateway no los enruta y por lo tanto no son alcanzables desde afuera.
 *
 * El prefijo /interno es una convención para dejar claro, a quien lea el
 * código, que estas rutas no son parte de la API pública.
 */
@Controller('interno')
export class InternoController {
  constructor(private readonly stock: StockService) {}

  /**
   * Paso 2 de la saga. Devuelve 200 tanto si aparta como si no hay stock: la
   * diferencia está en el campo `ok` del cuerpo. Órdenes necesita distinguir
   * "no hay stock" (respuesta de negocio) de "Productos no responde" (falla de
   * infraestructura), y mezclarlas en un 400 borraría esa diferencia.
   */
  @Post('apartar-stock')
  @HttpCode(HttpStatus.OK)
  async apartarStock(@Body() dto: MovimientoDeStockDto) {
    return this.stock.apartar(dto.lineas, dto.ordenId);
  }

  /** Compensación de la saga: deshace el apartado. */
  @Post('liberar-stock')
  @HttpCode(HttpStatus.OK)
  async liberarStock(@Body() dto: MovimientoDeStockDto) {
    return this.stock.liberar(dto.lineas, dto.ordenId);
  }

  /** Paso final: el pago se confirmó y la mercadería sale de bodega. */
  @Post('confirmar-venta')
  @HttpCode(HttpStatus.OK)
  async confirmarVenta(@Body() dto: MovimientoDeStockDto) {
    return this.stock.confirmarVenta(dto.lineas, dto.ordenId);
  }
}
