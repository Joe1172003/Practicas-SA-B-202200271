import type { NextFunction, Request, Response } from 'express';
import { marcarVersion } from './version.middleware';

describe('marcarVersion', () => {
  const original = process.env.VERSION_APP;

  afterEach(() => {
    if (original === undefined) delete process.env.VERSION_APP;
    else process.env.VERSION_APP = original;
  });

  it('pone la version en el encabezado y deja seguir la peticion', () => {
    process.env.VERSION_APP = '2.2.0';
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    marcarVersion({} as Request, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Version-Gateway', '2.2.0');
    expect(next).toHaveBeenCalled();
  });
});
