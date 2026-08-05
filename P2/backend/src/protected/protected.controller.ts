import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '../common/role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';


@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProtectedController {

  @Get('reportes')
  @Roles(Role.ADMIN)
  reportes(@UsuarioActual() usuario: JwtPayload) {
    return {
      mensaje: 'Acceso concedido al panel de reportes',
      recurso: 'reportes',
      requiere: [Role.ADMIN],
      accedidoPor: { id: usuario.sub, rol: usuario.rol }
    };
  }


  @Get('dashboard')
  @Roles(Role.ADMIN, Role.CLIENTE)
  dashboard(@UsuarioActual() usuario: JwtPayload) {
    return {
      mensaje: 'Acceso concedido al panel general',
      recurso: 'dashboard',
      requiere: [Role.ADMIN, Role.CLIENTE],
      accedidoPor: { id: usuario.sub, rol: usuario.rol },
    };
  }
}
