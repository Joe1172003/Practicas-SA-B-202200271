import { registerEnumType } from '@nestjs/graphql';

/**
 * Los cuatro estados por los que puede pasar una orden.
 *
 *   PENDIENTE: recién creada, con el stock ya apartado, esperando el pago
 *   PAGADA: el pago se confirmó y la venta quedó firme
 *   RECHAZADA: nunca se pudo apartar el stock, la orden murió al nacer
 *   CANCELADA: tenía stock apartado y se deshizo (aquí corre la compensación)
 *
 * La diferencia entre RECHAZADA y CANCELADA importa: en la primera no hay nada
 * que compensar porque nunca se apartó stock; en la segunda SÍ hay que
 * devolverlo. Si fueran un solo estado no sabríamos si toca compensar.
 */
export enum EstadoOrden {
  PENDIENTE = 'PENDIENTE',
  PAGADA = 'PAGADA',
  RECHAZADA = 'RECHAZADA',
  CANCELADA = 'CANCELADA',
}

// GraphQL no conoce los enums de TypeScript: hay que registrarlos para que
// aparezcan en el esquema como un tipo enum de verdad y no como texto libre.
registerEnumType(EstadoOrden, {
  name: 'EstadoOrden',
  description: 'Estados por los que pasa una orden',
});
