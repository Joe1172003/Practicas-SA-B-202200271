import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  estado() {
    return {
      estado: 'ok',
      servicio: 'api-gateway',
      version: 'p7-cicd',
      hora: new Date().toISOString(),
    };
  }
}
