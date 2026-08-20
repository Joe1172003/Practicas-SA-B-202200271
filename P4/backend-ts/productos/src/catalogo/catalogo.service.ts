import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Categoria } from './categoria.entity';
import { ActualizarProductoInput } from './dto/actualizar-producto.input';
import { CrearProductoInput } from './dto/crear-producto.input';
import { Producto } from './producto.entity';

/**
 * Lógica del catálogo: consultar, crear y actualizar productos.
 *
 * Este servicio no toca las columnas de stock apartado. Todo el movimiento de
 * stock vive en StockService, porque es lo que participa en la saga y conviene
 * tenerlo en un solo archivo, aparte del CRUD normal.
 */
@Injectable()
export class CatalogoService {
  constructor( @InjectRepository(Producto) private readonly productos: Repository<Producto>, @InjectRepository(Categoria) private readonly categorias: Repository<Categoria>
  ) {}

  // Lista el catálogo. Los dos filtros son opcionales y se combinan.
  async listarProductos(
    categoria?: string,
    busqueda?: string,
  ): Promise<Producto[]> {
    
    const condiciones: Record<string, unknown> = {};

    if (categoria) {
      condiciones.categoria = { nombre: ILike(categoria) };
    }

    if (busqueda) {
      condiciones.nombre = ILike(`%${busqueda}%`);
    }

    return this.productos.find({
      where: condiciones,
      order: { nombre: 'ASC' },
    });
  }

  async buscarProducto(id: string): Promise<Producto | null> {
    return this.productos.findOneBy({ id });
  }

  async listarCategorias(): Promise<Categoria[]> {
    return this.categorias.find({ order: { nombre: 'ASC' } });
  }

  async crearProducto(input: CrearProductoInput): Promise<Producto> {
    
    const categoriaExiste = await this.categorias.existsBy({
      id: input.categoriaId,
    });

    if (!categoriaExiste) {
      throw new BadRequestException('La categoría indicada no existe');
    }

    const producto = this.productos.create({
      nombre: input.nombre,
      descripcion: input.descripcion,
      precio: input.precio,
      stockDisponible: input.stockDisponible,

      // Un producto recién creado no tiene nada comprometido en órdenes.
      stockApartado: 0,
      categoriaId: input.categoriaId,
    });

    const guardado = await this.productos.save(producto);

    // Se vuelve a leer el producto en vez de devolver lo que retornó save().
    return this.recargar(guardado.id);
  }

  async actualizarProducto( id: string, input: ActualizarProductoInput): Promise<Producto> {
    const producto = await this.productos.findOneBy({ id });

    if (!producto) {
      throw new NotFoundException('El producto no existe');
    }

    if (input.categoriaId) {
      const categoriaExiste = await this.categorias.existsBy({
        id: input.categoriaId,
      });

      if (!categoriaExiste) {
        throw new BadRequestException('La categoría indicada no existe');
      }
    }

    // solo actualizar solo los campos que vinieron
    if (input.nombre !== undefined) producto.nombre = input.nombre;
    if (input.descripcion !== undefined) producto.descripcion = input.descripcion;
    if (input.precio !== undefined) producto.precio = input.precio;
    if (input.stockDisponible !== undefined) {
      producto.stockDisponible = input.stockDisponible;
    }
    if (input.categoriaId !== undefined) producto.categoriaId = input.categoriaId;

    await this.productos.save(producto);

    return this.recargar(id);
  }

  /** Vuelve a leer un producto de la base con su categoría ya cargada. */
  private async recargar(id: string): Promise<Producto> {
    const producto = await this.productos.findOneBy({ id });

    if (!producto) {
      throw new NotFoundException('El producto no existe');
    }

    return producto;
  }
}
