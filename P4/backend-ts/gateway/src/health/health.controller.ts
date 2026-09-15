import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  estado() {
    return {
      estado: 'ok',
      servicio: 'api-gateway',
      // La pone el chart con la etiqueta de la imagen. Asi la prueba de humo del
      // canary sabe si le esta hablando a la version nueva o a la estable.
      version: process.env.VERSION_APP ?? 'sin-version',
      hora: new Date().toISOString(),
    };
  }
}
