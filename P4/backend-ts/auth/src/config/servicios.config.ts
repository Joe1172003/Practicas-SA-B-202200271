import { registerAs } from '@nestjs/config';

// configuración de servicios externos
// se utiliza para obtener la URL del servicio de notificaciones 
// desde las variables de entorno
export interface ServiciosConfig {
  notificaciones: string;
}

export const serviciosConfig = registerAs('servicios', (): ServiciosConfig => ({
  notificaciones: process.env.URL_NOTIFICACIONES as string,
}));
