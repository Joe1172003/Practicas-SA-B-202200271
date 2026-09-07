import { envValidationSchema } from './env.validation';

describe('envValidationSchema (productos)', () => {
  const validar = (entorno: Record<string, unknown>) =>
    envValidationSchema.validate(entorno, { abortEarly: false });

  it('acepta una cadena de conexion de PostgreSQL y aplica los defaults', () => {
    const { error, value } = validar({
      DATABASE_URL: 'postgresql://usuario:clave@postgres:5432/db_productos',
    });

    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3002);
    expect(value.NODE_ENV).toBe('development');
    expect(value.DB_SYNCHRONIZE).toBe(false);
  });

  it('rechaza una base que no sea PostgreSQL con un mensaje explicito', () => {
    const { error } = validar({ DATABASE_URL: 'mysql://usuario@host/db' });

    expect(error).toBeDefined();
    expect(error?.message).toContain('PostgreSQL');
  });

  it('rechaza la configuracion si falta DATABASE_URL', () => {
    const { error } = validar({});

    expect(error).toBeDefined();
    expect(error?.message).toContain('DATABASE_URL');
  });

  it('convierte el texto de DB_SYNCHRONIZE en booleano', () => {
    // Un ConfigMap solo guarda texto, nunca booleanos. Sin esta conversion,
    // el string "false" seria un valor verdadero en JavaScript.
    const { error, value } = validar({
      DATABASE_URL: 'postgres://usuario@postgres:5432/db_productos',
      DB_SYNCHRONIZE: 'true',
    });

    expect(error).toBeUndefined();
    expect(value.DB_SYNCHRONIZE).toBe(true);
  });
});
