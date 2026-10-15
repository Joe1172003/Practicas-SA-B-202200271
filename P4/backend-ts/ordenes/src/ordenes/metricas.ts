import { metrics } from '@opentelemetry/api';

/**
 * Metricas de negocio: lo que le importa a alguien que no es ingeniero.
 *
 * Las de latencia y errores salen solas de la autoinstrumentacion. Estas no:
 * hay que contarlas en el punto exacto de la saga donde la orden cambia de
 * estado. En Prometheus aparecen con el sufijo _total.
 *
 * Sin el SDK de OpenTelemetry (en las pruebas unitarias) son contadores vacios
 * que no hacen nada, asi que no hace falta simularlos.
 */
const medidor = metrics.getMeter('ordenes');

/** ordenes_total{estado}: cuantas ordenes se crean, se pagan o se cancelan. */
export const ordenesPorEstado = medidor.createCounter('ordenes', {
  description: 'Ordenes que llegaron a cada estado de la saga',
  unit: '{orden}',
});

/** ordenes_rechazadas_total{causa}: clientes que se fueron sin poder comprar. */
export const ordenesRechazadas = medidor.createCounter('ordenes.rechazadas', {
  description: 'Ordenes rechazadas al apartar stock, por causa',
  unit: '{orden}',
});

/** ventas_quetzales_total: dinero de las ordenes pagadas. */
export const ventasQuetzales = medidor.createCounter('ventas.quetzales', {
  description: 'Monto en quetzales de las ordenes pagadas',
});

// Arrancan en 0. Un contador de OpenTelemetry no existe hasta su primer add(),
// asi que la primera venta aparecia en Prometheus ya valiendo 2300.5 y
// increase() no veia ninguna subida: el tablero decia "0 ventas" despues de
// una venta. Con el 0 registrado al arrancar, la primera venta sube de 0 a X.
export const ESTADOS = ['creada', 'pagada', 'cancelada'] as const;
export const CAUSAS_DE_RECHAZO = ['sin_stock', 'productos_no_responde'] as const;
for (const estado of ESTADOS) ordenesPorEstado.add(0, { estado });
for (const causa of CAUSAS_DE_RECHAZO) ordenesRechazadas.add(0, { causa });
ventasQuetzales.add(0);
