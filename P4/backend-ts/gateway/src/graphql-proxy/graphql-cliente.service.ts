import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

/**
 * Reenvía consultas GraphQL a un microservicio.
 */
@Injectable()
export class GraphqlClienteService {
  private readonly logger = new Logger(GraphqlClienteService.name);

  async reenviar(opciones: {
    urlDelServicio: string;
    consulta: unknown;

    // Identidad que el gateway ya resolvió. Viaja en headers simples para que
    // el microservicio de destino sepa quién pregunta sin tener que validar
    // ningún token.
    headersDeIdentidad: Record<string, string>;
  }): Promise<{ status: number; datos: unknown }> {
    const url = `${opciones.urlDelServicio}/graphql`;

    try {
      const respuesta = await axios.post(url, opciones.consulta, {
        headers: {
          'Content-Type': 'application/json',
          ...opciones.headersDeIdentidad,
        },
        // FALLO INDUCIDO P10 (rama fallo-inducido-p10, version 2.5.0): el
        // error humano tipico de creer que el timeout va en segundos. Axios lo
        // lee en milisegundos: 20 ms. Productos responde en 15-30 ms, asi que
        // buena parte del catalogo y todas las ordenes se cortan con 503. El
        // canary tiene que verlo en tasa-de-error y revertir solo.
        timeout: 20,

        // Igual que con Auth: un error de GraphQL es una respuesta válida que
        // hay que reenviar, no una excepción que el gateway deba tragarse.
        validateStatus: () => true,
      });

      return { status: respuesta.status, datos: respuesta.data };
    } catch (error) {
      const motivo = error instanceof Error ? error.message : 'desconocido';
      this.logger.error(`No se pudo contactar a ${url}: ${motivo}`);

      throw new ServiceUnavailableException(
        'El microservicio no está disponible en este momento',
      );
    }
  }
}
