import type { Params } from 'nestjs-pino';
import { stdTimeFunctions } from 'pino';

/**
 * Logs en JSON, una linea por evento, con el trace_id de la peticion.
 *
 * El trace_id y el span_id los agrega OpenTelemetry (instrumentation-pino) a
 * cada linea que se escribe dentro de una peticion. Con eso Loki y Tempo se
 * enlazan: desde una traza se ven sus logs y desde un log se abre su traza.
 */
const rutaCompleta = (req: { url?: string; originalUrl?: string }) => req.originalUrl ?? req.url;

export const configRegistros: Params = {
  pinoHttp: {
    // "level":"error" en texto, no el 50 de pino: Loki y Grafana lo entienden.
    formatters: {
      level: (nivel) => ({ level: nivel }),
    },
    timestamp: stdTimeFunctions.isoTime,

    // Una linea al terminar cada peticion. /health no: son las sondas de Kubernetes.
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    // originalUrl: Apollo monta GraphQL como subruta y Express le recorta la
    // url, asi que req.url decia "/" en vez de "/graphql".
    customSuccessMessage: (req, res) => `${req.method} ${rutaCompleta(req)} ${res.statusCode}`,
    customErrorMessage: (req, res) => `${req.method} ${rutaCompleta(req)} ${res.statusCode}`,

    // Lo justo para seguir la peticion. Sin headers: ahi viajan cookies y tokens.
    serializers: {
      req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  },
};
