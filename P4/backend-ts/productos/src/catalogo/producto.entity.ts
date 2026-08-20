import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Categoria } from './categoria.entity';

@ObjectType()
@Entity('productos')
export class Producto {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field()
  @Column({ type: 'varchar', length: 150 })
  nombre!: string;

  @Field()
  @Column({ type: 'text' })
  descripcion!: string;

  @Field(() => Float)
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,

    // trasformamos el string a número al leer de la base de datos, 
    // y lo dejamos como número al escribir.
    transformer: {
      to: (valor: number) => valor,
      from: (valor: string) => Number(valor),
    },
  })
  precio!: number;

  @Field(() => Int)
  @Column({ name: 'stock_disponible', type: 'int', default: 0 })
  stockDisponible!: number;


  // stokApartado no se puede vender ni apartar de nuevo,
  // solo devolver al disponible.
  @Field(() => Int)
  @Column({ name: 'stock_apartado', type: 'int', default: 0 })
  stockApartado!: number;

  @Field(() => ID)
  @Column({ name: 'categoria_id', type: 'uuid' })
  categoriaId!: string;

  
  @Field(() => Categoria)
  @ManyToOne(() => Categoria, { eager: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria!: Categoria;
}
