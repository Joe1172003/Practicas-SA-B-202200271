import { envValidationSchema } from './env.validation';

describe('envValidationSchema (ordenes)', () => {
  const entornoValido = {
    DATABASE_URL: 'postgresql://usuario:clave@postgres:5432/db_ordenes',
    URL_PRODUCTOS: 'http://productos:3002',
    RABBITMQ_URL: 'amqp://sa_p5:clave@rabbitmq:5672',
  };

  const validar = (entorno: Record<string, unknown>) =>
    envValidationSchema.validate(entorno, { abortEarly: false });

  it('acepta la configuracion minima y aplica los defaults', () => {
    const { error, value } = validar(entornoValido);

    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3003);
    expect(value.COLA_NOTIFICACIONES).toBe('notificaciones');
  });

  it('exige que la direccion del broker use amqp, no http', () => {
    // Apuntar el cliente de RabbitMQ a una URL http es un error facil de
    // cometer al copiar la de otro servicio, y sin esta regla se descubriria
    // hasta que la primera orden intenta publicar.
    const { error } = validar({ ...entornoValido, RABBITMQ_URL: 'http://rabbitmq:5672' });

    expect(error).toBeDefined();
    expect(error?.message).toContain('RABBITMQ_URL');
  });

  it('acepta amqps para una conexion cifrada', () => {
    const { error } = validar({
      ...entornoValido,
      RABBITMQ_URL: 'amqps://sa_p5:clave@rabbitmq:5671',
    });

    expect(error).toBeUndefined();
  });

  it('rechaza la configuracion si falta la direccion de Productos', () => {
    const { URL_PRODUCTOS, ...sinProductos } = entornoValido;
    const { error } = validar(sinProductos);

    expect(error).toBeDefined();
    expect(error?.message).toContain('URL_PRODUCTOS');
  });
});
