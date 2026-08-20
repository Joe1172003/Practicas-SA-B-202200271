import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternoController } from '../interno/interno.controller';
import { StockService } from '../interno/stock.service';
import { SemillaService } from '../semilla/semilla.service';
import { CatalogoResolver } from './catalogo.resolver';
import { CatalogoService } from './catalogo.service';
import { Categoria } from './categoria.entity';
import { Producto } from './producto.entity';

/**
 * Todo el catálogo en un módulo: sus dos entidades, la cara GraphQL, la cara
 * REST interna y la semilla.
 *
 * Se dejan juntos porque los tres trabajan sobre las mismas dos tablas.
 * Partirlos en tres módulos solo agregaría archivos de importaciones sin que
 * nada quede más claro.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Producto, Categoria])],
  controllers: [InternoController],
  providers: [CatalogoService, CatalogoResolver, StockService, SemillaService],
})
export class CatalogoModule {}
