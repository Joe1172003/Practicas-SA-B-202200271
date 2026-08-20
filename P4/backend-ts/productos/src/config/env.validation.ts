import * as Joi from 'joi';

// Si falta la URL de la base, el servicio no arranca. Mejor morir al inicio
// con un mensaje claro que fallar en la primera consulta.
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3002),

  DATABASE_URL: Joi.string()
    .pattern(/^postgres(ql)?:\/\//)
    .required()
    .messages({
      'string.pattern.base':
        'DATABASE_URL debe ser una cadena de conexión PostgreSQL (postgresql://...)',
    }),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
});
