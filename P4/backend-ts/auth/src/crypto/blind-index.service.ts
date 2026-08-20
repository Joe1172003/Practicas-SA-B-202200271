import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { cryptoConfig } from '../config/crypto.config';
import type { CryptoConfig } from '../config/crypto.config';


@Injectable()
export class BlindIndexService {
  private readonly llave: Buffer;

  constructor(@Inject(cryptoConfig.KEY) config: CryptoConfig) {
    this.llave = config.blindIndexKey;
  }

  // createHmac() devuelve un objeto que se puede usar para calcular un HMAC
  // HMAC = Hash-based Message Authentication Code, un hash con llave
  calcular(valor: string): string {
    const normalizado = valor.trim().toLowerCase();
    return createHmac('sha256', this.llave).update(normalizado).digest('hex');
  }
}
