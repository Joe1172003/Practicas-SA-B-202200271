import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Request } from 'express';
import { CrearOrdenInput } from './dto/crear-orden.input';
import { Orden } from './orden.entity';
import { OrdenesService } from './ordenes.service';
import { SagaService } from './saga.service';
import { obtenerUsuarioActual } from './usuario-actual';

/**
 * Resolver GraphQL del microservicio de Órdenes.
 *
 * Todas las operaciones exigen sesión
 */
@Resolver(() => Orden)
export class OrdenesResolver {
  constructor(
    private readonly ordenes: OrdenesService,
    private readonly saga: SagaService,
  ) {}


  // listar ordenes
  @Query(() => [Orden], { name: 'misOrdenes' })
  async misOrdenes( @Context() contexto: { req: Request },): Promise<Orden[]> {
    const usuario = obtenerUsuarioActual(contexto);

    return this.ordenes.misOrdenes(usuario.id);
  }

  // buscar por id una orden
  @Query(() => Orden, { name: 'orden', nullable: true })
  async orden( @Args('id', { type: () => ID }) id: string, @Context() contexto: { req: Request }): Promise<Orden | null> {
    const usuario = obtenerUsuarioActual(contexto);

    // El id del usuario viaja hasta el where de la consulta: nadie puede ver
    // una orden ajena aunque adivine su id.
    return this.ordenes.buscarOrden(id, usuario.id);
  }

  // mutaciones
  // crear orden 
  @Mutation(() => Orden)
  async crearOrden( @Args('input') input: CrearOrdenInput, @Context() contexto: { req: Request }): Promise<Orden> {
    const usuario = obtenerUsuarioActual(contexto);

    return this.ordenes.crearOrden(usuario.id, input);
  }

  // confirmar pago
  @Mutation(() => Orden)
  async confirmarPago( @Args('ordenId', { type: () => ID }) ordenId: string, @Context() contexto: { req: Request }): Promise<Orden> {
    const usuario = obtenerUsuarioActual(contexto);

    return this.saga.confirmarPago(ordenId, usuario.id, usuario.correo);
  }

  /** Cancelar: aquí es donde corre la compensación de la saga. */
  // cancelar orden
  @Mutation(() => Orden)
  async cancelarOrden( @Args('ordenId', { type: () => ID }) ordenId: string, @Context() contexto: { req: Request }): Promise<Orden> {
    const usuario = obtenerUsuarioActual(contexto);

    return this.saga.cancelarOrden(ordenId, usuario.id, usuario.correo);
  }
}
