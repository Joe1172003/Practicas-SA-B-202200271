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
 * Datos que acepta POST /auth/register.
 */
export class RegisterDto {
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
