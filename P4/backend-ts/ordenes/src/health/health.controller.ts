import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  estado() {
    return {
      estado: 'ok',
      servicio: 'ordenes',
      hora: new Date().toISOString(),
    };
  }
}
