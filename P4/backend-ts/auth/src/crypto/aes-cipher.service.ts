import { Inject, Injectable, InternalServerErrorException} from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { cryptoConfig } from '../config/crypto.config';
import type { CryptoConfig } from '../config/crypto.config';

const ALGORITMO = 'aes-256-gcm';
const LONGITUD_IV = 12;
const LONGITUD_ETIQUETA = 16;

@Injectable()
export class AesCipherService {
  private readonly llave: Buffer;

  constructor(@Inject(cryptoConfig.KEY) config: CryptoConfig) {
    this.llave = config.aesKey;
  }

  
  cifrar(textoPlano: string): string {
    const iv = randomBytes(LONGITUD_IV);
    const cifrador = createCipheriv(ALGORITMO, this.llave, iv);

    const cifrado = Buffer.concat([
      cifrador.update(textoPlano, 'utf8'),
      cifrador.final(),
    ]);
    const etiqueta = cifrador.getAuthTag();
    // retorno el cifrado en un solo string para guardarlo en la DB
    // formato: base64( IV[12] || ETIQUETA[16] || TEXTO_CIFRADO[n] )
    return Buffer.concat([iv, etiqueta, cifrado]).toString('base64');
  }

 
  descifrar(valorAlmacenado: string): string {
    const bytes = Buffer.from(valorAlmacenado, 'base64');

    // valido que el dato cifrado no este corrupto
    // el tamaño mínimo es IV + ETIQUETA, sin texto cifrado
    if (bytes.length <= LONGITUD_IV + LONGITUD_ETIQUETA) {
      throw new InternalServerErrorException(
        'El dato cifrado almacenado no tiene un formato válido',
      );
    }

    const iv = bytes.subarray(0, LONGITUD_IV);
    const etiqueta = bytes.subarray(
      LONGITUD_IV,
      LONGITUD_IV + LONGITUD_ETIQUETA,
    );
    const cifrado = bytes.subarray(LONGITUD_IV + LONGITUD_ETIQUETA);

    // descifro con la misma llave y el IV que se generó al cifrar
    const descifrador = createDecipheriv(ALGORITMO, this.llave, iv);
    descifrador.setAuthTag(etiqueta);

    try {
      // devolvemos el texto plano si todo esta bien
      return Buffer.concat([
        descifrador.update(cifrado),
        descifrador.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'No se pudo descifrar el dato: fue alterado o la llave AES cambió',
      );
    }
  }
}