import * as Joi from 'joi';

/**
 * Además de la base, este servicio necesita saber dónde viven Productos y
 * Notificaciones: sin esas dos direcciones la saga no puede ejecutarse. Si
 * falta alguna, el servicio no arranca.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3003),

  DATABASE_URL: Joi.string()
    .pattern(/^postgres(ql)?:\/\//)
    .required()
    .messages({
      'string.pattern.base':
        'DATABASE_URL debe ser una cadena de conexión PostgreSQL (postgresql://...)',
    }),
  DB_SYNCHRONIZE: Joi.boolean().default(false),

  URL_PRODUCTOS: Joi.string().uri().required(),
  URL_NOTIFICACIONES: Joi.string().uri().required(),
});
