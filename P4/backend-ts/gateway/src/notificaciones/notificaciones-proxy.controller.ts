import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SesionGuard } from '../auth/sesion.guard';
import type { RequestConUsuario } from '../auth/usuario-de-sesion.interface';
import { NotificacionesClienteService } from './notificaciones-cliente.service';

/**
 * Expone el historial de notificaciones del usuario logueado.
 */
@Controller('notificaciones')
@UseGuards(SesionGuard)
export class NotificacionesProxyController {
  constructor(
    private readonly notificaciones: NotificacionesClienteService,
  ) {}

  @Get()
  async misNotificaciones(
    @Req() request: RequestConUsuario,
    @Query('limite', new DefaultValuePipe(50), ParseIntPipe) limite: number,
  ) {
    // el correo sale de request.usuario,
    // que lo puso SesionGuard después de preguntarle a Auth de quién es la
    // cookie. no sale de un @Query('email').
    return this.notificaciones.historial(request.usuario.correo, limite);
  }
}
