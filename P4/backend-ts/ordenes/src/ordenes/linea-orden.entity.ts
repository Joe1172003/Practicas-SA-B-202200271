import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Orden } from './orden.entity';

/**
 * Un renglón de la orden: qué producto, cuántos y a qué precio.
 *
 * `nombreProducto` y `precioUnitario` son una copia de cómo estaba el producto
 * en el momento exacto de comprar. no son una referencia al catálogo..
 *
 * `productoId` se guarda igual, pero solo como referencia para rastrear. Nunca
 *  se usa para ir a leer el nombre o el precio actual.
 */
@ObjectType()
@Entity('lineas_orden')
export class LineaOrden {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field(() => ID)
  @Column({ name: 'orden_id', type: 'uuid' })
  ordenId!: string;

  // El id del producto en el otro microservicio. Aquí es un uuid suelto, no una
  // llave foránea: no puede serlo, porque la tabla `productos` vive en otra
  // base de datos. 
  @Field(() => ID)
  @Column({ name: 'producto_id', type: 'uuid' })
  productoId!: string;

  @Field()
  @Column({ name: 'nombre_producto', type: 'varchar', length: 150 })
  nombreProducto!: string;

  @Field(() => Float)
  @Column({
    name: 'precio_unitario',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: {
      to: (valor: number) => valor,
      // Postgres devuelve `numeric` como string para no perder precisión.
      from: (valor: string) => Number(valor),
    },
  })
  precioUnitario!: number;

  @Field(() => Int)
  @Column({ type: 'int' })
  cantidad!: number;

  @ManyToOne(() => Orden, (orden) => orden.lineas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden!: Orden;
}
