// Prueba de carga con concurrencia creciente contra el API Gateway.
// Se ejecuta dentro del cluster para no depender de minikube tunnel:

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const HOST = __ENV.HOST_INGRESS || 'sa-p5.local';
const BASE = __ENV.URL_BASE || 'http://ingress-nginx-controller.ingress-nginx.svc.cluster.local';

const erroresPropios = new Rate('errores_propios');
const latenciaHealth = new Trend('latencia_health', true);

export const options = {
  // Concurrencia creciente: cada escalon sube los usuarios virtuales para
  // que el HPA tenga tiempo de reaccionar y se vea el escalado.
  stages: [
    { duration: '30s', target: 20 },   
    { duration: '60s', target: 60 },   // carga media
    { duration: '90s', target: 120 },  // pico, aqui deberia escalar
    { duration: '30s', target: 0 },    // bajada, para ver el descenso de replicas
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],      
    http_req_duration: ['p(95)<1500'],   
  },
};

export default function () {
  const parametros = {
    headers: { Host: HOST },
    tags: { endpoint: 'health' },
  };

  const respuesta = http.get(`${BASE}/health`, parametros);

  const correcta = check(respuesta, {
    'responde 200': (r) => r.status === 200,
    'dice estado ok': (r) => r.body && r.body.includes('"estado":"ok"'),
  });

  erroresPropios.add(!correcta);
  latenciaHealth.add(respuesta.timings.duration);

  // Pausa corta: sin esto cada usuario virtual satura mas la red que la CPU
  // del gateway, y la prueba mediria el cliente y no el servidor.
  sleep(0.1);
}

export function handleSummary(datos) {
  const m = datos.metrics;
  const total = m.http_reqs.values.count;
  const rps = m.http_reqs.values.rate;
  const p95 = m.http_req_duration.values['p(95)'];
  const errores = m.http_req_failed.values.rate * 100;

  const linea = '-'.repeat(58);
  const texto = [
    linea,
    '  RESULTADO DE LA PRUEBA DE CARGA',
    linea,
    `  Peticiones totales : ${total}`,
    `  Peticiones/segundo : ${rps.toFixed(2)} RPS`,
    `  Latencia p95       : ${p95.toFixed(2)} ms`,
    `  Latencia promedio  : ${m.http_req_duration.values.avg.toFixed(2)} ms`,
    `  Tasa de error      : ${errores.toFixed(2)} %`,
    `  Usuarios virtuales : hasta ${m.vus_max.values.max}`,
    linea,
  ].join('\n');

  return { stdout: `\n${texto}\n` };
}
