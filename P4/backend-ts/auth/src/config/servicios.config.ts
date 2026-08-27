import { registerAs } from '@nestjs/config';

// CAMBIO DE LA P5: antes aqui vivia la URL del microservicio de
// Notificaciones. Ahora Auth no sabe que ese servicio existe: solo conoce
// la direccion del broker y el nombre de la cola donde deja los avisos.
//
// Ese es el desacople que trae la mensajeria: si manana el consumidor se
// reescribe en otro lenguaje o se parte en tres, Auth no se entera.
export interface ServiciosConfig {
  rabbitmqUrl: string;
  colaNotificaciones: string;
}

export const serviciosConfig = registerAs('servicios', (): ServiciosConfig => ({
  rabbitmqUrl: process.env.RABBITMQ_URL as string,
  colaNotificaciones: process.env.COLA_NOTIFICACIONES as string,
}));
