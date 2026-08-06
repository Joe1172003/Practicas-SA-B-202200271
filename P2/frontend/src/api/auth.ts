import type { Rol, Usuario } from '../types/usuario';
import { enviar, obtener } from './client';


interface RespuestaConUsuario {
  mensaje?: string;
  usuario: Usuario;
}

export interface DatosRegistro {
  nombre: string;
  correo: string;
  password: string;
  rol: Rol;
}

export async function registrar(datos: DatosRegistro): Promise<Usuario> {
  const respuesta = await enviar<RespuestaConUsuario>('/auth/register', datos);
  return respuesta.usuario;
}

export async function login(correo: string, password: string): Promise<Usuario> {
  const respuesta = await enviar<RespuestaConUsuario>('/auth/login', {
    correo,
    password,
  });
  return respuesta.usuario;
}

export async function logout(): Promise<void> {
  await enviar('/auth/logout');
}

// Esta función se usa en el AuthContext para saber si hay sesión al abrir la app.
export async function obtenerPerfil(): Promise<Usuario> {
  const respuesta = await obtener<RespuestaConUsuario>('/auth/me');
  return respuesta.usuario;
}
