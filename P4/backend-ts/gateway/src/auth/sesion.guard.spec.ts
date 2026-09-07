import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthClienteService, RespuestaDeAuth } from './auth-cliente.service';
import { SesionGuard } from './sesion.guard';
import { Role } from '../common/role.enum';

/**
 * El guard no verifica el JWT: le pregunta a Auth quien es el dueno de la
 * cookie. Lo que aqui se prueba es esa conversacion, sobre todo el reenvio del
 * Set-Cookie, que es de lo que depende la renovacion automatica del token.
 */
describe('SesionGuard', () => {
  let authCliente: { llamar: jest.Mock };
  let guard: SesionGuard;
  let respuesta: { setHeader: jest.Mock };

  // Arma un ExecutionContext con lo justo que el guard toca: el request y el response.
  const contextoCon = (peticion: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => peticion,
        getResponse: () => respuesta,
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    authCliente = { llamar: jest.fn() };
    respuesta = { setHeader: jest.fn() };
    guard = new SesionGuard(authCliente as unknown as AuthClienteService);
  });

  it('rechaza la peticion sin llamar a Auth si no viene ninguna cookie', async () => {
    const peticion = { headers: {} };

    await expect(guard.canActivate(contextoCon(peticion))).rejects.toThrow(
      UnauthorizedException,
    );

    // Lo importante: se corta antes de gastar una llamada de red.
    expect(authCliente.llamar).not.toHaveBeenCalled();
  });

  it('rechaza la peticion si Auth responde con algo distinto de 200', async () => {
    authCliente.llamar.mockResolvedValue({
      status: 401,
      datos: {},
    } satisfies RespuestaDeAuth);

    const peticion = { headers: { cookie: 'access_token=vencido' } };

    await expect(guard.canActivate(contextoCon(peticion))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('deja pasar, cuelga el usuario en la peticion y reenvia la cookie renovada', async () => {
    const usuario = {
      id: 'u1',
      nombre: 'Sergio',
      correo: 'sergio@test.com',
      rol: Role.ADMIN,
    };

    authCliente.llamar.mockResolvedValue({
      status: 200,
      datos: { usuario },
      cookies: ['access_token=renovado; HttpOnly'],
    } satisfies RespuestaDeAuth);

    const peticion: Record<string, unknown> = {
      headers: { cookie: 'access_token=viejo' },
    };

    await expect(guard.canActivate(contextoCon(peticion))).resolves.toBe(true);

    // La cookie que le llego al gateway se reenvia tal cual a Auth.
    expect(authCliente.llamar).toHaveBeenCalledWith({
      metodo: 'GET',
      ruta: '/auth/me',
      cookie: 'access_token=viejo',
    });

    expect(peticion.usuario).toEqual(usuario);

    // Sin este reenvio el navegador se quedaria con el token viejo aunque Auth
    // ya lo hubiera renovado, y la sesion moriria sola.
    expect(respuesta.setHeader).toHaveBeenCalledWith('Set-Cookie', [
      'access_token=renovado; HttpOnly',
    ]);
  });

  it('no toca la cabecera Set-Cookie cuando Auth no renovo nada', async () => {
    authCliente.llamar.mockResolvedValue({
      status: 200,
      datos: { usuario: { id: 'u1', nombre: 'Sergio', correo: 'sergio@test.com', rol: Role.CLIENTE } },
    } satisfies RespuestaDeAuth);

    const peticion: Record<string, unknown> = {
      headers: { cookie: 'access_token=vigente' },
    };

    await expect(guard.canActivate(contextoCon(peticion))).resolves.toBe(true);
    expect(respuesta.setHeader).not.toHaveBeenCalled();
  });
});
