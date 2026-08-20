import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

@InputType()
export class LineaDeOrdenInput {
  @Field(() => ID)
  @IsUUID('4', { message: 'El id del producto no es válido' })
  productoId!: string;

  @Field(() => Int)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser al menos 1' })
  cantidad!: number;
}

@InputType()
export class CrearOrdenInput {

  @Field()
  @IsUUID('4', { message: 'La clave de idempotencia debe ser un UUID v4' })
  claveIdempotencia!: string;

  @Field(() => [LineaDeOrdenInput])
  @IsArray()
  @ArrayMinSize(1, { message: 'La orden debe llevar al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => LineaDeOrdenInput)
  lineas!: LineaDeOrdenInput[];
}
