import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtConfig } from '../config/jwt.config';
import { Role } from '../common/role.enum';
import { TokenService } from './token.service';

/**
 * La politica de renovacion del token es la regla mas delicada del servicio:
 * un token vencido todavia sirve durante un rato, pero solo si la firma es
 * legitima. Estas pruebas fijan las tres salidas posibles y, sobre todo, que
 * la ventana de gracia nunca deje pasar un token falsificado.
 *
 * Se usa el JwtService real, no un mock: firmar y verificar de verdad es lo
 * unico que prueba que la politica funciona.
 */
describe('TokenService', () => {
  const SECRETO = 'secreto-de-pruebas-con-mas-de-32-caracteres';

  const config: JwtConfig = {
    secret: SECRETO,
    expiresInSeconds: 1800,
    renewalGraceSeconds: 300,
  };

  const jwtService = new JwtService({ secret: SECRETO });
  const servicio = new TokenService(jwtService, config);

  const carga = { sub: 'usuario-1', rol: Role.ADMIN };

  // expiresIn negativo produce un exp en el pasado de forma determinista:
  // no hace falta manipular el reloj ni esperar.
  const firmarVencidoHace = (segundos: number) =>
    jwtService.sign(carga, { expiresIn: -segundos });

  it('expone la duracion y la gracia que vienen de la configuracion', () => {
    expect(servicio.duracionSegundos).toBe(1800);
    expect(servicio.graciaSegundos).toBe(300);
  });

  it('acepta un token vigente sin pedir renovacion', async () => {
    const token = await servicio.firmar(carga);
    const resultado = await servicio.verificar(token);

    expect(resultado.necesitaRenovacion).toBe(false);
    expect(resultado.payload.sub).toBe('usuario-1');
    expect(resultado.payload.rol).toBe(Role.ADMIN);
  });

  it('acepta un token vencido hace poco y pide renovarlo', async () => {
    const token = firmarVencidoHace(10);
    const resultado = await servicio.verificar(token);

    // Dentro de los 300 s de gracia: la sesion sigue viva pero hay que
    // emitir un token nuevo.
    expect(resultado.necesitaRenovacion).toBe(true);
    expect(resultado.payload.sub).toBe('usuario-1');
  });

  it('rechaza un token vencido hace mas de la ventana de gracia', async () => {
    const token = firmarVencidoHace(400);

    await expect(servicio.verificar(token)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(servicio.verificar(token)).rejects.toThrow(/expir/i);
  });

  it('rechaza cualquier cosa que no sea un token', async () => {
    await expect(servicio.verificar('esto-no-es-un-jwt')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('no renueva un token vencido si la firma no es nuestra', async () => {
    // Un atacante que fabrique un token vencido con otro secreto no puede
    // colarse por la puerta de la renovacion: la firma se sigue verificando.
    const intruso = new JwtService({ secret: 'otro-secreto-distinto-cualquiera' });
    const token = intruso.sign(carga, { expiresIn: -10 });

    await expect(servicio.verificar(token)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
