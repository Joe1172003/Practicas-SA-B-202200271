import { Body, Controller, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SesionGuard } from '../auth/sesion.guard';
import type { RequestConUsuario } from '../auth/usuario-de-sesion.interface';
import { serviciosConfig } from '../config/servicios.config';
import type { ServiciosConfig } from '../config/servicios.config';
import { ConsultaGraphqlDto } from './dto/consulta-graphql.dto';
import { GraphqlClienteService } from './graphql-cliente.service';

/**
 * Enruta las consultas GraphQL de órdenes hacia el microservicio de Órdenes.
 *
 * a diferencia del catálogo, aquí la sesión es OBLIGATORIA (por eso el
 * SesionGuard). No existe una orden anónima: `misOrdenes` no significa nada sin
 * saber quién es "mi", y crear una orden a nombre de nadie tampoco.
 *
 * Se rechaza con 401 antes de siquiera molestar al microservicio de Órdenes.
 */
@Controller('graphql/ordenes')
@UseGuards(SesionGuard)
export class OrdenesProxyController {
  constructor(
    private readonly graphqlCliente: GraphqlClienteService,
    @Inject(serviciosConfig.KEY)
    private readonly servicios: ServiciosConfig,
  ) {}

  @Post()
  async consultar(
    @Body() consulta: ConsultaGraphqlDto,
    @Req() request: RequestConUsuario,
    @Res({ passthrough: true }) response: Response,
  ) {
    // El guard ya validó la cookie contra Auth y dejó el usuario en la
    // petición. Aquí solo se traduce a headers para el siguiente servicio.
    const resultado = await this.graphqlCliente.reenviar({
      urlDelServicio: this.servicios.ordenes,
      consulta,
      headersDeIdentidad: {
        'x-usuario-id': request.usuario.id,
        'x-usuario-rol': request.usuario.rol,

        // El correo va porque Órdenes lo necesita para las notificaciones.
        // Se manda desde aquí en vez de que Órdenes se lo pregunte a Auth: ya
        // lo tenemos a mano y así se evita otro salto entre servicios.
        'x-usuario-correo': request.usuario.correo,
      },
    });

    response.status(resultado.status);

    return resultado.datos;
  }
}
