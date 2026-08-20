import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/role.enum';

/**
 * Datos que acepta POST /auth/register en el gateway.
 *
 * Es una copia del DTO de la Práctica 2. El microservicio de Auth vuelve a
 * validar lo mismo por su cuenta, y eso está bien: el gateway rechaza la basura
 * temprano y le ahorra el viaje a Auth, pero Auth no confía ciegamente en quien
 * lo llama. Un microservicio nunca da por hecho que el de enfrente ya validó.
 */
export class RegistrarDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede pasar de 100 caracteres' })
  nombre!: string;

  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(160)
  correo!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede pasar de 72 caracteres' })
  password!: string;

  @IsOptional()
  @IsEnum(Role, { message: 'El rol debe ser ADMIN o CLIENTE' })
  rol?: Role;
}
