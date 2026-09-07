import { envValidationSchema } from './env.validation';

/**
 * El gateway no arranca si le falta la URL de un microservicio. Estas pruebas
 * fijan ese contrato: que los defaults se apliquen y que lo obligatorio falte
 * con un mensaje claro en vez de dejar el servicio a medio configurar.
 */
describe('envValidationSchema (gateway)', () => {
  // Lo minimo que el esquema exige. Cada prueba parte de aqui y cambia una cosa.
  const entornoValido = {
    URL_AUTH: 'http://auth:3001',
    URL_PRODUCTOS: 'http://productos:3002',
    URL_ORDENES: 'http://ordenes:3003',
  };

  const validar = (entorno: Record<string, unknown>) =>
    envValidationSchema.validate(entorno, { abortEarly: false });

  it('acepta la configuracion minima y rellena los valores por defecto', () => {
    const { error, value } = validar(entornoValido);

    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3000);
    expect(value.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('rechaza la configuracion si falta la URL de un microservicio', () => {
    const { URL_AUTH, ...sinAuth } = entornoValido;
    const { error } = validar(sinAuth);

    expect(error).toBeDefined();
    expect(error?.message).toContain('URL_AUTH');
  });

  it('rechaza un CORS_ORIGIN con barra final, que no es como el navegador manda el Origin', () => {
    const { error } = validar({
      ...entornoValido,
      CORS_ORIGIN: 'http://localhost:5173/',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('CORS_ORIGIN');
  });

  it('acepta varios origenes separados por coma', () => {
    const { error, value } = validar({
      ...entornoValido,
      CORS_ORIGIN: 'http://localhost:5173,http://localhost:5174',
    });

    expect(error).toBeUndefined();
    expect(value.CORS_ORIGIN).toBe('http://localhost:5173,http://localhost:5174');
  });

  it('rechaza un NODE_ENV que no sea development, production o test', () => {
    const { error } = validar({ ...entornoValido, NODE_ENV: 'staging' });

    expect(error).toBeDefined();
    expect(error?.message).toContain('NODE_ENV');
  });
});
