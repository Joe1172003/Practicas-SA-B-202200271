import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Role } from '../common/role.enum';
import { AesCipherService } from '../crypto/aes-cipher.service';
import { BlindIndexService } from '../crypto/blind-index.service';
import { PasswordHasherService } from '../crypto/password-hasher.service';
import { PerfilUsuario } from './perfil-usuario.interface';
import { User } from './user.entity';

const VIOLACION_UNIQUE = '23505';

interface DatosDeRegistro {
  nombre: string;
  correo: string;
  password: string;
  rol: Role;
}

/**
 * Única puerta de entrada a la tabla `users`.
 *
 * Aquí se concentra todo el cifrado y descifrado. El módulo de autenticación
 * trabaja con nombres y correos normales y no se entera de que por debajo hay
 * AES, HMAC y bcrypt.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repositorio: Repository<User>,
    private readonly aes: AesCipherService,
    private readonly indiceCiego: BlindIndexService,
    private readonly hasher: PasswordHasherService,
  ) {}

  /// Crea un usuario nuevo, cifrando y hasheando los datos sensibles.
  async crear(datos: DatosDeRegistro): Promise<User> {
    const correoIndice = this.indiceCiego.calcular(datos.correo);

    const yaExiste = await this.repositorio.existsBy({ correoIndice });
    if (yaExiste) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }

    const usuario = this.repositorio.create({
      nombreCifrado: this.aes.cifrar(datos.nombre.trim()),
      correoCifrado: this.aes.cifrar(datos.correo.trim().toLowerCase()),
      correoIndice,
      passwordHash: await this.hasher.hashear(datos.password),
      rol: datos.rol,
    });

    try {
      return await this.repositorio.save(usuario);
    } catch (error) {
      if (this.esCorreoDuplicado(error)) {
        throw new ConflictException('Ya existe una cuenta con ese correo');
      }
      throw error;
    }
  }

  /// Busca un usuario por su correo. Devuelve null si no existe.
  async buscarPorCorreo(correo: string): Promise<User | null> {
    return this.repositorio.findOneBy({
      correoIndice: this.indiceCiego.calcular(correo),
    });
  }

  /// Busca un usuario por su ID. Devuelve null si no existe.
  async buscarPorId(id: string): Promise<User | null> {
    return this.repositorio.findOneBy({ id });
  }

  /// Comprueba una contraseña contra el hash guardado.
  async passwordEsValida(usuario: User, password: string): Promise<boolean> {
    return this.hasher.verificar(password, usuario.passwordHash);
  }

  async simularVerificacionDePassword(password: string): Promise<void> {
    await this.hasher.simularVerificacion(password);
  }

  /// Convierte un usuario de la base de datos en un perfil seguro para el frontend.
  aPerfil(usuario: User): PerfilUsuario {
    return {
      id: usuario.id,
      nombre: this.aes.descifrar(usuario.nombreCifrado),
      correo: this.aes.descifrar(usuario.correoCifrado),
      rol: usuario.rol,
    };
  }
  
  private esCorreoDuplicado(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string })?.code === VIOLACION_UNIQUE
    );
  }
}
