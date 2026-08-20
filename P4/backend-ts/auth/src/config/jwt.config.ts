import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  secret: string;
  expiresInSeconds: number;
  renewalGraceSeconds: number;
}


export const jwtConfig = registerAs('jwt', (): JwtConfig => ({
  secret: process.env.JWT_SECRET as string,
  expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS),
  renewalGraceSeconds: Number(process.env.JWT_RENEWAL_GRACE_SECONDS),
}));
