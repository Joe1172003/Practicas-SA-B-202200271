import { registerAs } from '@nestjs/config';

export interface CookieConfig {
  name: string;
  secure: boolean;
}

export const cookieConfig = registerAs('cookie', (): CookieConfig => ({
  name: process.env.COOKIE_NAME as string,
  secure: process.env.COOKIE_SECURE === 'true',
}));
