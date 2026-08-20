import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from '../catalogo/categoria.entity';
import { Producto } from '../catalogo/producto.entity';

/**
 * Mete datos iniciales al arrancar, pero solo si la base está vacía.
 *
 * Porque el esquema de GraphQL tiene la consulta
 * `categorias` pero NO tiene una mutación para crear categorías, y
 * `crearProducto` exige un `categoriaId`. Sin estas categorías iniciales no
 * habría forma de crear ni un solo producto.
 *
 * Los tres productos de ejemplo son para poder probar la saga de órdenes de
 * una vez, sin tener que registrar un ADMIN primero.
 */
@Injectable()
export class SemillaService implements OnModuleInit {
  private readonly logger = new Logger(SemillaService.name);

  constructor(
    @InjectRepository(Categoria)
    private readonly categorias: Repository<Categoria>,
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
  ) {}

  async onModuleInit(): Promise<void> {
    // La comprobación es lo que hace que esto sea seguro de correr siempre: si
    // ya hay datos, no toca nada. Reiniciar el contenedor no duplica el
    // catálogo ni pisa los cambios que se hayan hecho por GraphQL.
    const yaHayCategorias = await this.categorias.count();

    if (yaHayCategorias > 0) {
      this.logger.log('El catálogo ya tiene datos, no se siembra nada');
      return;
    }

    const guardadas = await this.categorias.save([
      { nombre: 'Laptops' },
      { nombre: 'Celulares' },
      { nombre: 'Accesorios' },
    ]);

    const porNombre = (nombre: string) =>
      guardadas.find((categoria) => categoria.nombre === nombre)!.id;

    await this.productos.save([
      {
        nombre: 'Laptop Lenovo ThinkPad',
        descripcion: 'Core i7, 16GB RAM, 512GB SSD',
        precio: 8500.0,
        stockDisponible: 10,
        stockApartado: 0,
        categoriaId: porNombre('Laptops'),
      },
      {
        nombre: 'Celular Samsung A54',
        descripcion: '128GB, cámara de 50MP',
        precio: 2300.5,
        stockDisponible: 25,
        stockApartado: 0,
        categoriaId: porNombre('Celulares'),
      },
      {
        nombre: 'Mouse Logitech M170',
        descripcion: 'Inalámbrico, receptor USB',
        precio: 120.0,

        stockDisponible: 3,
        stockApartado: 0,
        categoriaId: porNombre('Accesorios'),
      },
    ]);

    this.logger.log('Catálogo inicial sembrado: 3 categorías y 3 productos');
  }
}
