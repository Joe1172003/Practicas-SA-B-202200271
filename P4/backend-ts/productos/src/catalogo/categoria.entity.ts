import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 *  Una categoría del catálogo.
 */

@ObjectType()
@Entity('categorias')
export class Categoria {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field()
  @Column({ type: 'varchar', length: 80, unique: true })
  nombre!: string;
}
