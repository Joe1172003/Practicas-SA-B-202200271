import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StockService } from './stock.service';

/**
 * StockService es la parte de Productos que entra en la saga. Se prueba con un
 * DataSource falso: lo que interesa no es el SQL en si, sino como interpreta el
 * servicio lo que devuelve la base, y que quedarse sin stock salga como una
 * respuesta de negocio (ok:false) y no como una excepcion.
 */
describe('StockService', () => {
  let manager: { query: jest.Mock };
  let servicio: StockService;

  beforeEach(() => {
    manager = { query: jest.fn() };

    const dataSource = {
      transaction: jest.fn(
        async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager),
      ),
    } as unknown as DataSource;

    servicio = new StockService(dataSource);

    // El servicio registra cada movimiento; en las pruebas solo ensucia la salida.
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('apartar', () => {
    it('aparta la linea y devuelve el precio como numero', async () => {
      // Postgres devuelve numeric como texto: si no se convierte, el total de
      // la orden terminaria concatenando cadenas en vez de sumando.
      manager.query.mockResolvedValueOnce([
        [{ nombre: 'Teclado', precio: '99.50' }],
        1,
      ]);

      const resultado = await servicio.apartar(
        [{ productoId: 'p1', cantidad: 2 }],
        'o1',
      );

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.lineas).toEqual([
          {
            productoId: 'p1',
            nombreProducto: 'Teclado',
            precioUnitario: 99.5,
            cantidad: 2,
          },
        ]);
        expect(typeof resultado.lineas[0].precioUnitario).toBe('number');
      }
    });

    it('responde ok:false cuando el producto no existe', async () => {
      manager.query
        .mockResolvedValueOnce([[], 0]) // el UPDATE no afecto ninguna fila
        .mockResolvedValueOnce([]); // el SELECT del diagnostico no encuentra nada

      const resultado = await servicio.apartar([
        { productoId: 'p-fantasma', cantidad: 1 },
      ]);

      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.motivo).toBe('El producto p-fantasma no existe');
      }
    });

    it('responde ok:false explicando cuanto stock habia cuando no alcanza', async () => {
      manager.query
        .mockResolvedValueOnce([[], 0])
        .mockResolvedValueOnce([{ nombre: 'Mouse', stock_disponible: 2 }]);

      const resultado = await servicio.apartar([
        { productoId: 'p2', cantidad: 5 },
      ]);

      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.motivo).toContain('Mouse');
        expect(resultado.motivo).toContain('5');
        expect(resultado.motivo).toContain('2');
      }
    });

    it('no aparta nada si falla una sola linea de varias', async () => {
      manager.query
        .mockResolvedValueOnce([[{ nombre: 'Teclado', precio: '99.50' }], 1]) // la primera si
        .mockResolvedValueOnce([[], 0]) // la segunda no
        .mockResolvedValueOnce([{ nombre: 'Mouse', stock_disponible: 0 }]);

      const resultado = await servicio.apartar([
        { productoId: 'p1', cantidad: 1 },
        { productoId: 'p2', cantidad: 1 },
      ]);

      // O se apartan todas o ninguna: la transaccion revierte la primera.
      expect(resultado.ok).toBe(false);
    });
  });

  describe('liberar (compensacion de la saga)', () => {
    it('devuelve el stock de cada linea sin dejar el apartado en negativo', async () => {
      manager.query.mockResolvedValue([]);

      const resultado = await servicio.liberar(
        [
          { productoId: 'p1', cantidad: 2 },
          { productoId: 'p2', cantidad: 1 },
        ],
        'o1',
      );

      expect(resultado.ok).toBe(true);
      expect(manager.query).toHaveBeenCalledTimes(2);

      // GREATEST es lo que impide que una doble compensacion deje el
      // stock_apartado por debajo de cero.
      expect(manager.query.mock.calls[0][0]).toContain('GREATEST');
    });
  });

  describe('confirmarVenta', () => {
    it('solo baja el stock apartado, nunca el disponible', async () => {
      manager.query.mockResolvedValue([]);

      const resultado = await servicio.confirmarVenta(
        [{ productoId: 'p1', cantidad: 2 }],
        'o1',
      );

      expect(resultado.ok).toBe(true);

      // El disponible ya se descontó al apartar: tocarlo aqui lo restaria dos veces.
      const sql = manager.query.mock.calls[0][0] as string;
      expect(sql).toContain('stock_apartado');
      expect(sql).not.toContain('stock_disponible');
    });
  });
});
