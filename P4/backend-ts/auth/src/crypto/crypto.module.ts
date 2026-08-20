import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { cryptoConfig } from '../config/crypto.config';
import { AesCipherService } from './aes-cipher.service';
import { BlindIndexService } from './blind-index.service';
import { PasswordHasherService } from './password-hasher.service';

/**
 * Agrupa todo lo criptográfico en un solo módulo.
 *
 * El resto de la aplicación no sabe qué algoritmo se usa ni de dónde salen las
 * llaves: solo pide estos servicios. 
 */
@Module({
  imports: [ConfigModule.forFeature(cryptoConfig)],
  providers: [AesCipherService, BlindIndexService, PasswordHasherService],
  exports: [AesCipherService, BlindIndexService, PasswordHasherService],
})
export class CryptoModule {}
