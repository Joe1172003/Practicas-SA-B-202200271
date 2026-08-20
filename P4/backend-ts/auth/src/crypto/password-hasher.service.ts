import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { cryptoConfig } from '../config/crypto.config';
import type { CryptoConfig } from '../config/crypto.config';

// La contraseña no se cifra con AES, sino que se guarda como hash de una sola vía con bcrypt. 
@Injectable()
export class PasswordHasherService implements OnModuleInit {
  private hashSenuelo = '';

  constructor(
    @Inject(cryptoConfig.KEY)
    private readonly config: CryptoConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    this.hashSenuelo = await hash(
      randomBytes(32).toString('hex'),
      this.config.bcryptSaltRounds,
    );
  }

  /* Genera el hash que se guarda en la BD. */
  async hashear(passwordPlano: string): Promise<string> {
    return hash(passwordPlano, this.config.bcryptSaltRounds);
  }

  /* verifica la contraseña contra el hash guardado */
  async verificar(passwordPlano: string, hashGuardado: string): Promise<boolean> {
    return compare(passwordPlano, hashGuardado);
  }

  async simularVerificacion(passwordPlano: string): Promise<void> {
    await compare(passwordPlano, this.hashSenuelo);
  }
}
