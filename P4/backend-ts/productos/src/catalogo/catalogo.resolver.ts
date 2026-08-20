import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CatalogoService } from './catalogo.service';
import { Categoria } from './categoria.entity';
import { ActualizarProductoInput } from './dto/actualizar-producto.input';
import { CrearProductoInput } from './dto/crear-producto.input';
import { Producto } from './producto.entity';
import { SoloAdminGuard } from './solo-admin.guard';


// Resolver = controlador
// recive la peticion , llama al servicio, devuelve el resultado
// la logica esta en catalogo.services.ts
@Resolver(() => Producto)
export class CatalogoResolver {
  constructor(private readonly catalogo: CatalogoService) {}

  // listar por productos
  @Query(() => [Producto], { name: 'productos' })
  async listarProductos(
    @Args('categoria', { nullable: true }) categoria?: string,
    @Args('busqueda', { nullable: true }) busqueda?: string,
  ): Promise<Producto[]> {
    return this.catalogo.listarProductos(categoria, busqueda);
  }

  // buscar producto
  @Query(() => Producto, { name: 'producto', nullable: true })
  async buscarProducto(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Producto | null> {
    return this.catalogo.buscarProducto(id);
  }

  @Query(() => [Categoria], { name: 'categorias' })
  async listarCategorias(): Promise<Categoria[]> {
    return this.catalogo.listarCategorias();
  }

  // mutaciones = post, put

  // crear productos
  @Mutation(() => Producto)
  @UseGuards(SoloAdminGuard)
  async crearProducto(
    @Args('input') input: CrearProductoInput,
  ): Promise<Producto> {
    return this.catalogo.crearProducto(input);
  }
  
  // actualizar producto
  @Mutation(() => Producto)
  @UseGuards(SoloAdminGuard)
  async actualizarProducto(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: ActualizarProductoInput,
  ): Promise<Producto> {
    return this.catalogo.actualizarProducto(id, input);
  }
}
