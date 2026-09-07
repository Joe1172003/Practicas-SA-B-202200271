import { BadRequestException, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NotificacionesCliente } from '../clientes/notificaciones.cliente';
import { ProductosCliente } from '../clientes/productos.cliente';
import { EstadoOrden } from './estado-orden.enum';
import { Orden } from './orden.entity';
import { OrdenesService } from './ordenes.service';
import { SagaService } from './saga.service';

/**
 * La saga existe porque no hay ROLLBACK que abarque db_ordenes y db_productos
 * al mismo tiempo. Lo que reemplaza al rollback es la compensacion, y eso es
 * justo lo que se prueba aqui: que cuando el inventario no confirma, la orden
 * se cancele Y el stock se devuelva, en ese orden.
 */
describe('SagaService', () => {
  let repositorio: { save: jest.Mock };
  let ordenesService: { obtenerOrden: jest.Mock };
  let productos: { confirmarVenta: jest.Mock; liberarStock: jest.Mock };
  let notificaciones: { notificar: jest.Mock };
  let saga: SagaService;

  const ordenPendiente = (): Orden =>
    ({
      id: 'o1',
      estado: EstadoOrden.PENDIENTE,
      total: 199,
      lineas: [
        { productoId: 'p1', cantidad: 2 },
        { productoId: 'p2', cantidad: 1 },
      ],
    }) as unknown as Orden;

  beforeEach(() => {
    repositorio = { save: jest.fn(async (orden: Orden) => orden) };
    ordenesService = { obtenerOrden: jest.fn() };
    productos = { confirmarVenta: jest.fn(), liberarStock: jest.fn() };
    notificaciones = { notificar: jest.fn() };

    saga = new SagaService(
      repositorio as unknown as Repository<Orden>,
      ordenesService as unknown as OrdenesService,
      productos as unknown as ProductosCliente,
      notificaciones as unknown as NotificacionesCliente,
    );

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('confirmarPago', () => {
    it('deja la orden PAGADA y avisa, sin compensar nada', async () => {
      ordenesService.obtenerOrden.mockResolvedValue(ordenPendiente());
      productos.confirmarVenta.mockResolvedValue(true);

      const resultado = await saga.confirmarPago('o1', 'u1', 'cliente@test.com');

      expect(resultado.estado).toBe(EstadoOrden.PAGADA);
      expect(notificaciones.notificar).toHaveBeenCalledWith(
        'orden_pagada',
        'cliente@test.com',
        expect.objectContaining({ ordenId: 'o1', total: 199 }),
      );

      // El camino feliz no toca la compensacion.
      expect(productos.liberarStock).not.toHaveBeenCalled();
    });

    it('cancela la orden y devuelve el stock si el inventario no confirma', async () => {
      ordenesService.obtenerOrden.mockResolvedValue(ordenPendiente());
      productos.confirmarVenta.mockResolvedValue(false);

      const resultado = await saga.confirmarPago('o1', 'u1', 'cliente@test.com');

      expect(resultado.estado).toBe(EstadoOrden.CANCELADA);

      // La compensacion: el stock apartado vuelve al catalogo. Sin esto
      // quedaria bloqueado para siempre sin que nadie lo compre.
      expect(productos.liberarStock).toHaveBeenCalledWith('o1', [
        { productoId: 'p1', cantidad: 2 },
        { productoId: 'p2', cantidad: 1 },
      ]);

      expect(notificaciones.notificar).toHaveBeenCalledWith(
        'orden_cancelada',
        'cliente@test.com',
        expect.objectContaining({ ordenId: 'o1' }),
      );
    });

    it('guarda la orden ANTES de liberar el stock', async () => {
      ordenesService.obtenerOrden.mockResolvedValue(ordenPendiente());
      productos.confirmarVenta.mockResolvedValue(false);

      await saga.confirmarPago('o1', 'u1', 'cliente@test.com');

      // Si se liberara primero y el proceso muriera en medio, quedaria una
      // orden PENDIENTE con el stock ya devuelto: alguien podria pagarla y el
      // inventario se iria a negativo. Este orden deja el fallo visible.
      expect(repositorio.save.mock.invocationCallOrder[0]).toBeLessThan(
        productos.liberarStock.mock.invocationCallOrder[0],
      );
    });

    it('no vuelve a cobrar una orden que ya esta PAGADA', async () => {
      const yaPagada = { ...ordenPendiente(), estado: EstadoOrden.PAGADA } as Orden;
      ordenesService.obtenerOrden.mockResolvedValue(yaPagada);

      await expect(
        saga.confirmarPago('o1', 'u1', 'cliente@test.com'),
      ).rejects.toThrow(BadRequestException);

      // Lo importante no es solo el error: es que ni siquiera se intente cobrar.
      expect(productos.confirmarVenta).not.toHaveBeenCalled();
    });
  });

  describe('cancelarOrden', () => {
    it('cancela una orden pendiente, deja el motivo y compensa', async () => {
      ordenesService.obtenerOrden.mockResolvedValue(ordenPendiente());

      const resultado = await saga.cancelarOrden('o1', 'u1', 'cliente@test.com');

      expect(resultado.estado).toBe(EstadoOrden.CANCELADA);
      expect(resultado.motivo).toBe('Cancelada por el cliente');
      expect(productos.liberarStock).toHaveBeenCalledTimes(1);
    });

    it('no cancela dos veces la misma orden', async () => {
      const yaCancelada = {
        ...ordenPendiente(),
        estado: EstadoOrden.CANCELADA,
      } as Orden;
      ordenesService.obtenerOrden.mockResolvedValue(yaCancelada);

      await expect(
        saga.cancelarOrden('o1', 'u1', 'cliente@test.com'),
      ).rejects.toThrow(BadRequestException);

      // Compensar dos veces devolveria el stock por duplicado.
      expect(productos.liberarStock).not.toHaveBeenCalled();
    });
  });
});
