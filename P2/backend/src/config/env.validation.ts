import * as Joi from 'joi';

/**
 * Regla reutilizable para las llaves criptográficas.
 *
 * AES-256 y HMAC-SHA256 necesitan exactamente 32 bytes. Como en el .env viajan
 * codificadas en base64, aquí las decodificamos solo para medirlas: si alguien
 * pega una llave corta, la app no arranca. Es preferible fallar al inicio y no
 * en medio de un login.
 */
const llaveDe32Bytes = Joi.string()
  .base64()
  .custom((valor: string, helpers) => {
    if (Buffer.from(valor, 'base64').length !== 32) {
      return helpers.error('any.invalid');
    }
    return valor;
  }, 'llave de 32 bytes codificada en base64')
  .required();

/**
 * Contrato de las variables de entorno.
 *
 * Nest valida este esquema ANTES de construir los módulos. Si falta una
 * variable o tiene un valor imposible, el proceso muere con un mensaje claro
 * en vez de arrancar a medias y fallar más adelante sin explicación.
 */
export const envValidationSchema = Joi.object({
  // --- Servidor ---
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  CORS_ORIGIN: Joi.string().uri().default('http://localhost:5173'),

  // --- Base de datos ---
  DATABASE_URL: Joi.string()
    .pattern(/^postgres(ql)?:\/\//)
    .required()
    .messages({
      'string.pattern.base':
        'DATABASE_URL debe ser una cadena de conexión PostgreSQL (postgresql://...)',
    }),
  DB_SYNCHRONIZE: Joi.boolean().default(false),

  // --- JWT ---
  // 32 caracteres es el mínimo razonable para que la firma HS256 no sea débil.
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN_SECONDS: Joi.number().integer().positive().default(60),
  JWT_RENEWAL_GRACE_SECONDS: Joi.number().integer().min(0).default(300),

  // --- Cookie ---
  COOKIE_NAME: Joi.string().default('access_token'),
  COOKIE_SECURE: Joi.boolean().default(false),

  // --- Criptografía ---
  AES_KEY: llaveDe32Bytes,
  BLIND_INDEX_KEY: llaveDe32Bytes,

  // Debajo de 10 rondas bcrypt se vuelve demasiado rápido de atacar por fuerza
  // bruta; arriba de 15 el login se siente lento para el usuario.
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),
});
