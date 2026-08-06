/**
 * Wrapper de fetch: el ÚNICO lugar del frontend que habla HTTP.
 *
 * Centraliza tres cosas que, si se olvidaran en una sola petición,
 * romperían la app de formas difíciles de detectar:
 *
 * 1. `credentials: 'include'` — el JWT viaja en una cookie HTTP-only, y como
 *    el frontend (5173) y el backend (3000) son orígenes distintos, el
 *    navegador NO manda la cookie salvo que cada fetch lo pida explícitamente.
 *    Sin esta línea el login "funciona" pero ninguna ruta protegida.
 *
 * 2. Errores uniformes — cualquier respuesta que no sea 2xx se convierte en
 *    un `ErrorApi` con el status y un mensaje legible, así las páginas hacen
 *    un solo try/catch y muestran `error.mensaje` sin preguntarse el formato.
 *
 * 3. La cabecera `X-Token-Renovado` — el backend la manda cuando renovó el
 *    token automáticamente. Aquí se detecta y se avisa al resto de la app
 *    con un evento del navegador (el Navbar lo escucha para mostrar un aviso).
 */

const BASE_URL = import.meta.env.VITE_API_URL as string;

/** Nombre del evento que se dispara cuando el backend renueva la sesión. */
export const EVENTO_TOKEN_RENOVADO = 'token-renovado';

/** Error que lanzan todas las funciones de la carpeta api/. */
export class ErrorApi extends Error {
  /** Código HTTP de la respuesta (0 si ni siquiera hubo conexión). */
  readonly status: number;
  /** Mensaje listo para mostrar en pantalla. */
  readonly mensaje: string;

  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.mensaje = mensaje;
  }
}

/**
 * El backend responde los errores como { message: "..." } o, en los 400 de
 * validación, como { message: ["error 1", "error 2"] }. Esta función deja
 * siempre un solo string listo para mostrar.
 */
function extraerMensaje(cuerpo: unknown): string {
  if (cuerpo && typeof cuerpo === 'object' && 'message' in cuerpo) {
    const message = (cuerpo as { message: string | string[] }).message;
    return Array.isArray(message) ? message.join('. ') : message;
  }
  return 'Ocurrió un error inesperado';
}

// funcion reutilizable para hacer peticiones HTTP al backend
export async function obtener<T>(ruta: string): Promise<T> {
  return hacerPeticion<T>(ruta, { method: 'GET' });
}

export async function enviar<T>(ruta: string, datos?: unknown): Promise<T> {
  return hacerPeticion<T>(ruta, {
    method: 'POST',
    headers: datos ? { 'Content-Type': 'application/json' } : undefined,
    body: datos ? JSON.stringify(datos) : undefined,
  });
}

// funcion reutilizavle para hacer peticiones HTTP al backend
async function hacerPeticion<T>(ruta: string, opciones: RequestInit): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(BASE_URL + ruta, {
      ...opciones,
      // crendials: 'include' es lo que hace que el navegador mande la cookie HTTP-only
      credentials: 'include',
    });
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor.');
  }

  // El backend avisa con esta cabecera que reemplazó la cookie por un token
  // nuevo. Se propaga como evento del navegador para
  // que cualquier componente pueda reaccionar sin acoplarse a esta capa.
  if (respuesta.headers.get('X-Token-Renovado') === 'true') {
    window.dispatchEvent(new CustomEvent(EVENTO_TOKEN_RENOVADO));
  }

  const cuerpo: unknown = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, extraerMensaje(cuerpo));
  }

  return cuerpo as T;
}