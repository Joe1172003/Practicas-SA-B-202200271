// Prueba de integracion del canary: recorre el camino critico de un usuario
// pasando por la version nueva del gateway, que a su vez habla con auth y
// productos. Cada vuelta usa un correo distinto para no chocar con otras.
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE || 'http://gateway-canary:3000';
const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

// El 401 del final lo pido yo a proposito: no lo cuento como error.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 401));

export const options = {
  vus: 1,
  iterations: 3,
  thresholds: {
    // El flujo completo tiene que salir bien las 3 veces.
    checks: ['rate==1'],
    http_req_failed: ['rate==0'],
    // Con la 2.0.0 dio p95 1.32 s: el registro y el login usan bcrypt, que es
    // lento a proposito. 3 s es mas o menos el doble.
    http_req_duration: ['p(95)<3000'],
  },
};

function campo(respuesta, nombre) {
  try {
    return respuesta.json(nombre);
  } catch (error) {
    return undefined;
  }
}

export default function () {
  const correo = `canary-${Date.now()}-${__VU}-${__ITER}@sa-p8.local`;
  const credenciales = { correo, password: `Prueba-${Date.now()}` };

  const registro = http.post(`${BASE}/auth/register`,
    JSON.stringify({ nombre: 'Prueba canary', ...credenciales }), JSON_HEADERS);
  check(registro, { 'registro 201': (r) => r.status === 201 });

  // k6 guarda la cookie de sesion del login y la manda sola en lo que sigue.
  const login = http.post(`${BASE}/auth/login`, JSON.stringify(credenciales), JSON_HEADERS);
  check(login, { 'login 200': (r) => r.status === 200 });

  const yo = http.get(`${BASE}/auth/me`);
  check(yo, {
    'auth/me 200': (r) => r.status === 200,
    'auth/me devuelve mi correo': (r) => campo(r, 'usuario.correo') === correo,
  });

  const catalogo = http.post(`${BASE}/graphql/productos`,
    JSON.stringify({ query: '{ productos { id nombre stockDisponible } }' }), JSON_HEADERS);
  check(catalogo, {
    'catalogo 200': (r) => r.status === 200,
    'catalogo trae productos': (r) => (campo(r, 'data.productos') || []).length > 0,
  });

  const salida = http.post(`${BASE}/auth/logout`);
  check(salida, { 'logout 200': (r) => r.status === 200 });

  const sinSesion = http.get(`${BASE}/auth/me`);
  check(sinSesion, { 'sin sesion da 401': (r) => r.status === 401 });
}
