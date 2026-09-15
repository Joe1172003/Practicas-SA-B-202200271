// Prueba de humo del canary: lo minimo para saber que la version nueva esta
// viva y que es la que dice ser. Si esto falla, no tiene sentido seguir.
//
// Argo Rollouts la corre como un Job contra el Service gateway-canary, que
// solo apunta a los Pods de la version nueva. Si k6 sale con error, el Job
// falla y el canary se revierte.
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE || 'http://gateway-canary:3000';
const VERSION = __ENV.VERSION_ESPERADA || '';

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    // Las 5 vueltas tienen que pasar enteras: en humo no hay margen.
    checks: ['rate==1'],
    http_req_duration: ['p(95)<500'],
  },
};

// Lee un campo del JSON sin romper la prueba si la respuesta no es JSON.
function campo(respuesta, nombre) {
  try {
    return respuesta.json(nombre);
  } catch (error) {
    return undefined;
  }
}

export default function () {
  const respuesta = http.get(`${BASE}/health`);

  check(respuesta, {
    'health responde 200': (r) => r.status === 200,
    'estado ok': (r) => campo(r, 'estado') === 'ok',
    // Confirma que le estoy hablando a la version nueva y no a la estable.
    'es la version nueva': (r) => VERSION === '' || campo(r, 'version') === VERSION,
  });
}
