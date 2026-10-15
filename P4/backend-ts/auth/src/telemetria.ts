import type { IncomingMessage } from 'node:http';
import { SpanKind } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK, tracing } from '@opentelemetry/sdk-node';

/**
 * Solo empieza una traza nueva lo que llega desde afuera: una peticion HTTP
 * (SERVER) o un mensaje de la cola (CONSUMER). Lo que Nest hace al arrancar
 * ("Create Nest App", conectar a postgres, armar el esquema GraphQL) no es una
 * peticion de nadie y ensuciaba la busqueda en Tempo. Los tramos hijos siguen
 * la decision de su padre (ParentBased).
 */
const soloPeticiones: tracing.Sampler = {
  shouldSample: (_contexto, _trazaId, _nombre, tipo) => ({
    decision:
      tipo === SpanKind.SERVER || tipo === SpanKind.CONSUMER
        ? tracing.SamplingDecision.RECORD_AND_SAMPLED
        : tracing.SamplingDecision.NOT_RECORD,
  }),
  toString: () => 'soloPeticiones',
};

/**
 * OpenTelemetry: trazas y metricas de este servicio.
 *
 * Tiene que cargarse ANTES que NestJS (es el primer import de main.ts): la
 * autoinstrumentacion envuelve http, express, pg, axios y compania en el
 * momento en que se cargan, y si Nest ya los cargo llega tarde.
 *
 * Nombre, version y a donde mandar todo llegan por variables del chart:
 * OTEL_SERVICE_NAME, OTEL_RESOURCE_ATTRIBUTES (service.version) y
 * OTEL_EXPORTER_OTLP_ENDPOINT (el Collector). Con OTEL_SDK_DISABLED=true no
 * hace nada, que es lo que pasa en desarrollo.
 */
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  sampler: new tracing.ParentBasedSampler({ root: soloPeticiones }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    // Cada 15 s, al ritmo de Prometheus: el canary decide en pocos minutos.
    exportIntervalMillis: 15000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Ruido: cada lectura de archivo o consulta DNS seria un tramo de la traza.
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
      // Express queda completo a proposito. En la v2.4.1 le quite los tramos de
      // middleware (ignoreLayersType) y no solo no los quito: rompio la ruta de
      // las metricas, que paso de "/graphql/productos" a
      // "{/*splat}{/*splat}/graphql/productos". Prefiero trazas con mas tramos
      // y una etiqueta http_route correcta, que es la que usan los SLO.
      '@opentelemetry/instrumentation-http': {
        // Las sondas de Kubernetes piden /health cada pocos segundos. No son
        // usuarios: no cuentan para la latencia ni para los errores.
        ignoreIncomingRequestHook: (req: IncomingMessage) => req.url === '/health',
      },
      '@opentelemetry/instrumentation-graphql': {
        // Un tramo por operacion, no uno por cada campo que se resuelve.
        ignoreTrivialResolveSpans: true,
        mergeItems: true,
      },
      // Solo agrega trace_id y span_id a cada log; los logs los lee el Collector
      // del stdout del contenedor, no se mandan por OTLP.
      '@opentelemetry/instrumentation-pino': { disableLogSending: true },
    }),
  ],
});

sdk.start();

// Al apagar el Pod, manda lo que quede pendiente antes de salir.
process.once('SIGTERM', () => {
  void sdk.shutdown().finally(() => process.exit(0));
});
