import type { NextFunction, Request, Response } from 'express';

/**
 * Marca cada respuesta con la version del gateway que la atendio.
 *
 * Durante un canary conviven dos versiones detras del mismo dominio: con este
 * encabezado se ve desde afuera, request por request, cual respondio.
 */
export function marcarVersion(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Version-Gateway', process.env.VERSION_APP ?? 'sin-version');
  next();
}
