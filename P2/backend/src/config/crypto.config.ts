import { registerAs } from '@nestjs/config';

export interface CryptoConfig {
  aesKey: Buffer;
  blindIndexKey: Buffer;
  bcryptSaltRounds: number;
}

export const cryptoConfig = registerAs('crypto', (): CryptoConfig => ({
  aesKey: Buffer.from(process.env.AES_KEY as string, 'base64'),
  blindIndexKey: Buffer.from(process.env.BLIND_INDEX_KEY as string, 'base64'),
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS),
}));