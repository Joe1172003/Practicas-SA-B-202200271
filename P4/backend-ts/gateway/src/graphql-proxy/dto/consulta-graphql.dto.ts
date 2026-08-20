import { IsObject, IsOptional, IsString, IsNotEmpty } from 'class-validator';

/**
 * El gateway solo comprueba que la consulta venga y sea texto: NO intenta
 * entender qué pide. Interpretarla sería el trabajo del microservicio dueño
 * del esquema, y meterse ahí acoplaría al gateway con ese esquema.
 */
export class ConsultaGraphqlDto {
  @IsString()
  @IsNotEmpty({ message: 'La consulta GraphQL no puede ir vacía' })
  query: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  // Lo mandan los clientes que tienen varias operaciones en un mismo documento.
  @IsOptional()
  @IsString()
  operationName?: string;
}
