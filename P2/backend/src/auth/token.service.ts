import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { jwtConfig } from '../config/jwt.config';
import type { JwtConfig } from '../config/jwt.config';
import { JwtPayload, JwtPayloadFirmado } from './jwt-payload.interface';


export interface ResultadoVerificacion {
  payload: JwtPayloadFirmado;
  necesitaRenovacion: boolean;
}

/**
 * Todo lo relacionado con firmar y validar el JWT.
 *
 * El guard no sabe nada de algoritmos ni de tiempos: le pregunta a este
 * servicio si el token sirve y este le responde, además, si toca renovarlo.
 */
@Injectable()
export class TokenService {
  constructor( private readonly jwtService: JwtService, @Inject(jwtConfig.KEY) private readonly config: JwtConfig,) {}

  /** Cuánto vive un token recién emitido*/
  get duracionSegundos(): number {
    return this.config.expiresInSeconds;
  }

  // Cuánto tiempo después de expirar se puede renovar un token.
  get graciaSegundos(): number {
    return this.config.renewalGraceSeconds;
  }

  // Emite un token nuevo. La duración sale de JWT_EXPIRES_IN_SECONDS.
  async firmar(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      expiresIn: this.config.expiresInSeconds,
    });
  }

  // Valida el token de la cookie aplicando la política de renovación.
  // 1. Token vigente: se acepta, `necesitaRenovacion = false`.
  // 2. Token vencido: necesitamos ver hace cuanto. renueva si hace menos de JWT_RENEWAL_GRACE_SECONDS,
  // `necesitaRenovacion = true` para que el guard lo renueve.
  // 3. Token inválido: se rechaza, lanza UnauthorizedException.

  async verificar(token: string): Promise<ResultadoVerificacion> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayloadFirmado>(token);
      return { payload, necesitaRenovacion: false };
    } catch (error) {
      if (!this.esTokenExpirado(error)) {
        throw new UnauthorizedException('Token inválido');
      }
      return this.intentarRenovacion(token);
    }
  }

  // El token expiró. Lo volvemos a abrir ignorando la fecha de expiración
  // pero sin ignorar la firma, que se sigue validando para ver hace cuánto vencio
  private async intentarRenovacion(token: string): Promise<ResultadoVerificacion> {
    let payload: JwtPayloadFirmado;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayloadFirmado>(token, {
        ignoreExpiration: true,
      });
    } catch {
      throw new UnauthorizedException('Token inválido');
    }

    const ahoraEnSegundos = Math.floor(Date.now() / 1000);
    const segundosDesdeQueExpiro = ahoraEnSegundos - payload.exp;
    
    // si el token expiró hace más de JWT_RENEWAL_GRACE_SECONDS, no lo renovamos
    if (segundosDesdeQueExpiro > this.config.renewalGraceSeconds) {
      throw new UnauthorizedException(
        'La sesión expiró. Vuelve a iniciar sesión.',
      );
    }

    return { payload, necesitaRenovacion: true };
  }

  private esTokenExpirado(error: unknown): boolean {
    return error instanceof Error && error.name === 'TokenExpiredError';
  }
}
