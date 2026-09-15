import { HealthController } from './health.controller';

describe('HealthController', () => {
  const original = process.env.VERSION_APP;

  afterEach(() => {
    if (original === undefined) delete process.env.VERSION_APP;
    else process.env.VERSION_APP = original;
  });

  it('responde con la version que le pone el chart', () => {
    process.env.VERSION_APP = '2.1.0';
    const respuesta = new HealthController().estado();
    expect(respuesta.estado).toBe('ok');
    expect(respuesta.version).toBe('2.1.0');
  });

  it('sin la variable avisa que no sabe su version', () => {
    delete process.env.VERSION_APP;
    expect(new HealthController().estado().version).toBe('sin-version');
  });
});
