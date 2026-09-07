import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../common/role.enum';
import { RolesGuard } from './roles.guard';

/**
 * El guard decide con dos datos: los roles que el decorador @Roles() dejo en
 * la metadata, y el usuario que JwtAuthGuard colgo en la peticion. Aqui se
 * cubren las cuatro combinaciones que importan.
 */
describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  const contextoCon = (usuario?: { sub: string; rol: Role }): ExecutionContext =>
    ({
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ usuario }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('deja pasar cuando la ruta no declara ningun rol', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(contextoCon({ sub: 'u1', rol: Role.CLIENTE }))).toBe(
      true,
    );
  });

  it('deja pasar cuando la lista de roles viene vacia', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(contextoCon({ sub: 'u1', rol: Role.CLIENTE }))).toBe(
      true,
    );
  });

  it('rechaza con 401 si la ruta exige rol pero no hay usuario en la peticion', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(() => guard.canActivate(contextoCon(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza con 403 si el usuario esta autenticado pero con otro rol', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    // Distinguir 401 de 403 importa: uno dice "identificate", el otro dice
    // "ya se quien sos y aun asi no podes".
    expect(() =>
      guard.canActivate(contextoCon({ sub: 'u1', rol: Role.CLIENTE })),
    ).toThrow(ForbiddenException);
  });

  it('deja pasar cuando el rol del usuario esta en la lista permitida', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(guard.canActivate(contextoCon({ sub: 'u1', rol: Role.ADMIN }))).toBe(
      true,
    );
  });
});
