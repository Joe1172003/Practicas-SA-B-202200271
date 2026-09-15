// Prueba de carga del canary. Sale del k6-carga.js de la P5, pero en vez de
// pegarle solo a /health, cada vuelta hace lo que mas usa la tienda y no
// escribe en la base: /health y el catalogo por GraphQL.
//
// Le pega al Service gateway-canary, o sea solo a la version nueva: mide lo
// que se esta por liberar, no la mezcla con la estable. Si se pasa un umbral,
// k6 sale con error, el Job falla y Argo Rollouts revierte el canary.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://gateway-canary:3000';
const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'catalogo' } };
const CONSULTA = JSON.stringify({ query: '{ productos { id nombre precio stockDisponible } }' });

export const options = {
  // Cuantos usuarios y por cuanto tiempo lo decide cada paso del canary.
  vus: Number(__ENV.USUARIOS || 5),
  duration: __ENV.DURACION || '30s',
  // Umbrales sacados de medir la version 2.0.0 sobre un solo Pod, igual que el
  // canary: con 5 usuarios dio p95 12 ms y con 15 usuarios p95 52 ms, las dos
  // veces con 0% de errores (P8/evidencias/rollouts/linea-base-2.0.0.txt).
  thresholds: {
    // Errores HTTP (4xx y 5xx). La estable da 0%: el 1% tolera un tropiezo
    // aislado, pero una version rota falla en masa y lo pasa enseguida.
    http_req_failed: ['rate<0.01'],
    // Respuestas que llegan pero mal, como un GraphQL con "errors" y status 200.
    checks: ['rate>0.99'],
    // Unas 6 veces el p95 del paso mas pesado: deja margen para el ruido de un
    // cluster chico, pero atrapa una version varias veces mas lenta. Y 300 ms
    // todavia se siente inmediato para quien navega el catalogo.
    http_req_duration: ['p(95)<300'],
  },
};

export default function () {
  const salud = http.get(`${BASE}/health`, { tags: { endpoint: 'health' } });
  check(salud, { 'health 200': (r) => r.status === 200 });

  const catalogo = http.post(`${BASE}/graphql/productos`, CONSULTA, JSON_HEADERS);
  check(catalogo, {
    'catalogo 200': (r) => r.status === 200,
    'catalogo sin errores': (r) => typeof r.body === 'string' && !r.body.includes('"errors"'),
  });

  // Medio segundo entre vueltas, como un usuario que mira la pagina. Sin pausa,
  // k6 mediria cuanto aguanta la red del cliente y no el gateway.
  sleep(0.5);
}

// El reporte que queda en el log del Job. Es el mismo formato de la P5.
export function handleSummary(datos) {
  const m = datos.metrics;
  const umbrales = Object.entries(m)
    .filter(([, metrica]) => metrica.thresholds)
    .map(([nombre, metrica]) => Object.entries(metrica.thresholds)
      .map(([regla, estado]) => `    ${estado.ok ? 'PASA ' : 'FALLA'}  ${nombre} ${regla}`).join('\n'))
    .join('\n');

  const linea = '-'.repeat(58);
  const texto = [
    linea,
    '  RESULTADO DE LA PRUEBA DE CARGA',
    linea,
    `  Destino            : ${BASE}`,
    `  Usuarios virtuales : ${m.vus_max.values.max}`,
    `  Peticiones totales : ${m.http_reqs.values.count}`,
    `  Peticiones/segundo : ${m.http_reqs.values.rate.toFixed(2)}`,
    `  Latencia p95       : ${m.http_req_duration.values['p(95)'].toFixed(2)} ms`,
    `  Latencia promedio  : ${m.http_req_duration.values.avg.toFixed(2)} ms`,
    `  Tasa de error      : ${(m.http_req_failed.values.rate * 100).toFixed(2)} %`,
    `  Checks correctos   : ${(m.checks.values.rate * 100).toFixed(2)} %`,
    '  Umbrales:',
    umbrales,
    linea,
  ].join('\n');

  return { stdout: `\n${texto}\n` };
}
