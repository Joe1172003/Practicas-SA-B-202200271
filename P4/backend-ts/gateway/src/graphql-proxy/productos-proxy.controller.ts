import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthClienteService } from '../auth/auth-cliente.service';
import { serviciosConfig } from '../config/servicios.config';
import type { ServiciosConfig } from '../config/servicios.config';
import { ConsultaGraphqlDto } from './dto/consulta-graphql.dto';
import { GraphqlClienteService } from './graphql-cliente.service';

/**
 * Enruta las consultas GraphQL del catálogo hacia el microservicio de
 * Productos.
 *
 * Se expone en /graphql/productos y no en /graphql a secas porque el gateway
 * tiene DOS servicios con GraphQL (Productos y Órdenes) y no los federa: cada
 * uno necesita su propia ruta.
 */
@Controller('graphql/productos')
export class ProductosProxyController {
  constructor(
    private readonly graphqlCliente: GraphqlClienteService,
    private readonly authCliente: AuthClienteService,
    @Inject(serviciosConfig.KEY)
    private readonly servicios: ServiciosConfig,
  ) {}

  @Post()
  async consultar(
    @Body() consulta: ConsultaGraphqlDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    // La sesión aquí es OPCIONAL, a diferencia de /auth/me. Cualquiera puede
    // ver el catálogo sin haber iniciado sesión, igual que en cualquier tienda
    // en línea. Quien SÍ exige rol es el microservicio de Productos, y solo
    // para las mutaciones: si no le llega el header de ADMIN, las rechaza.
    const identidad = await this.identificarUsuario(request, response);

    // DEFECTO INDUCIDO A PROPOSITO (P8, fallo inducido). Cada consulta al
    // catalogo espera 1 segundo de mas: una regresion de rendimiento que no
    // rompe nada (responde 200 con los datos correctos) pero vuelve lenta la
    // tienda. Vive solo en la rama fallo-inducido y en el tag v2.3.0: el
    // canary la tiene que detectar con la prueba de carga y revertirla solo.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const resultado = await this.graphqlCliente.reenviar({
      urlDelServicio: this.servicios.productos,
      consulta,
      headersDeIdentidad: identidad,
    });

    response.status(resultado.status);

    return resultado.datos;
  }

  /**
   * Traduce la cookie del navegador a headers de identidad.
   *
   * Devuelve un objeto vacío si no hay sesión o si la cookie ya no sirve. No
   * lanza un 401 a propósito: quien no traiga identidad simplemente pasa como
   * visitante anónimo y podrá hacer consultas pero no mutaciones.
   */
  private async identificarUsuario(
    request: Request,
    response: Response,
  ): Promise<Record<string, string>> {
    const cookie = request.headers.cookie;

    if (!cookie) {
      return {};
    }

    const respuesta = await this.authCliente.llamar({
      metodo: 'GET',
      ruta: '/auth/me',
      cookie,
    });

    if (respuesta.status !== 200) {
      return {};
    }

    // Si Auth renovó el token, se le pasa la cookie nueva al navegador. Sin
    // esto, un usuario que navega el catálogo perdería la renovación
    // automática que sí funciona en las rutas de /auth.
    if (respuesta.cookies) {
      response.setHeader('Set-Cookie', respuesta.cookies);
    }

    const cuerpo = respuesta.datos as {
      usuario: { id: string; rol: string };
    };

    return {
      'x-usuario-id': cuerpo.usuario.id,
      'x-usuario-rol': cuerpo.usuario.rol,
    };
  }
}
