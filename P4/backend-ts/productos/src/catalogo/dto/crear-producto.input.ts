import { Field, Float, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Datos para crear un producto.
 */
@InputType()
export class CrearProductoInput {
  @Field()
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(150)
  nombre!: string;

  @Field()
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  descripcion!: string;

  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio lleva máximo 2 decimales' })
  @IsPositive({ message: 'El precio tiene que ser mayor a cero' })
  precio!: number;

  @Field(() => Int)
  @IsInt()
  @Min(0, { message: 'El stock no puede ser negativo' })
  stockDisponible!: number;

  @Field()
  @IsUUID('4', { message: 'La categoría no es un identificador válido' })
  categoriaId!: string;
}
