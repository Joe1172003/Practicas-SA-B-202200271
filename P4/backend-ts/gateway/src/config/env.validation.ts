import * as Joi from 'joi';

/**
 * Contrato de las variables de entorno del gateway.
 *
 * si falta una URL de un microservicio, el gateway
 * no arranca. Es mejor que muera al inicio con un mensaje claro y no que
 * arranque bien y luego devuelva un error raro la primera vez que alguien
 * intente hacer login.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  CORS_ORIGIN: Joi.string()
    .pattern(/^https?:\/\/[^\s,/]+(,\s*https?:\/\/[^\s,/]+)*$/)
    .default('http://localhost:5173'),

  // Direcciones de los cuatro microservicios.
  URL_AUTH: Joi.string().uri().required(),
  URL_PRODUCTOS: Joi.string().uri().required(),
  URL_ORDENES: Joi.string().uri().required(),
});
