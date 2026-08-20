import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/** Un renglón del movimiento: qué producto y cuántas unidades. */
export class LineaDeMovimientoDto {
  @IsUUID('4', { message: 'El id del producto no es válido' })
  productoId: string;

  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser al menos 1' })
  cantidad: number;
}

/**
 * Cuerpo que reciben los tres endpoints internos de stock.
 *
 * Es el contrato entre Órdenes y Productos. Es un DTO plano a propósito: los
 * dos servicios tienen su propia copia de esta forma y no comparten una
 * librería. Si compartieran código, dejarían de poder desplegarse por separado.
 */
export class MovimientoDeStockDto {
  // Solo para poder rastrear en los logs qué orden pidió el movimiento.
  // Es opcional porque Productos no necesita saber nada de órdenes para
  // trabajar: no guarda este dato ni consulta la base de Órdenes.
  @IsOptional()
  @IsString()
  ordenId?: string;

  // `@ValidateNested` + `@Type` son obligatorios para que class-validator entre
  // a revisar cada objeto del arreglo. Sin ellos solo comprobaría que es un
  // arreglo, y adentro podría venir cualquier cosa.
  @IsArray()
  @ArrayMinSize(1, { message: 'El movimiento debe tener al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => LineaDeMovimientoDto)
  lineas: LineaDeMovimientoDto[];
}
