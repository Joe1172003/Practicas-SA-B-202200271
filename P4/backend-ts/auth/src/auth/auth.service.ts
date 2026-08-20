import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Role } from '../common/role.enum';
import { NotificacionesCliente } from '../notificaciones/notificaciones.cliente';
import { PerfilUsuario } from '../users/perfil-usuario.interface';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';

export interface ResultadoAutenticacion {
  perfil: PerfilUsuario;
  token: string;
}

// esta clase solo verifica credenciales y produce un token, no toca cookies ni response
// quien guarda el token en la cookie es el controlador, que tiene acceso a response

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly notificaciones: NotificacionesCliente,
  ) {}

  async registrar(dto: RegisterDto): Promise<ResultadoAutenticacion> {
    const usuario = await this.users.crear({
      nombre: dto.nombre,
      correo: dto.correo,
      password: dto.password,
      rol: dto.rol ?? Role.CLIENTE,
    });

    // aviso al microservicio de Notificaciones.
    this.notificaciones.notificar('usuario_registrado', dto.correo, {
      nombre: dto.nombre,
    });

    return this.emitirSesion(usuario);
  }

  // Verifica que el correo y la contraseña sean correctos y devuelve un token.
  async login(dto: LoginDto): Promise<ResultadoAutenticacion> {
    const usuario = await this.users.buscarPorCorreo(dto.correo);

    // por que hago esto es para que no se pueda saber si el correo existe o no, si no existe se simula 
    // la verificacion de password para que tarde lo mismo y no se pueda deducir
    // pero siempre lannzo un UnathorizedException
    if (!usuario) {
      await this.users.simularVerificacionDePassword(dto.password);
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const passwordCorrecta = await this.users.passwordEsValida(usuario, dto.password);

    if (!passwordCorrecta) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    return this.emitirSesion(usuario);
  }

  // Devuelve los datos descifrados del usuario dueño de la sesión
  async obtenerPerfil(idUsuario: string): Promise<PerfilUsuario> {
    const usuario = await this.users.buscarPorId(idUsuario);

    if (!usuario) {
      throw new UnauthorizedException('La cuenta ya no existe');
    }

    return this.users.aPerfil(usuario);
  }

  
  private async emitirSesion(usuario: User): Promise<ResultadoAutenticacion> {
    // aqui obtengo el token de tokenService
    const token = await this.tokens.firmar({
      sub: usuario.id,
      rol: usuario.rol,
    });
    // retorno el perfil y el token
    return { perfil: this.users.aPerfil(usuario), token };
  }
}
