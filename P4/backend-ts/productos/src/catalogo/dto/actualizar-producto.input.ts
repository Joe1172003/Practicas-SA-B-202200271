import { Field, Float, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Datos para actualizar un producto. Todos los campos son opcionales: se
 * cambia solo lo que venga en la petición y lo demás se queda como estaba.
 */
@InputType()
export class ActualizarProductoInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  descripcion?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El precio tiene que ser mayor a cero' })
  precio?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'El stock no puede ser negativo' })
  stockDisponible?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID('4')
  categoriaId?: string;
}
