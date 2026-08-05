import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Datos que acepta POST /auth/login. */
export class LoginDto {
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(160)
  correo!: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MaxLength(72)
  password!: string;
}
