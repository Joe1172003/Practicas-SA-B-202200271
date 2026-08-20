import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoOrden } from './estado-orden.enum';
import { LineaOrden } from './linea-orden.entity';

@ObjectType()
@Entity('ordenes')
export class Orden {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // es un uuid suelto y no una llave foránea: la tabla `users` vive en db_auth, que este
  // servicio no puede ni tocar.
  @Field(() => ID)
  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @Field(() => EstadoOrden)
  @Column({ type: 'varchar', length: 20 })
  estado!: EstadoOrden;

  @Field(() => Float)
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: {
      to: (valor: number) => valor,
      from: (valor: string) => Number(valor),
    },
  })
  total!: number;

  /**
   * PATRÓN IDEMPOTENT CONSUMER.
   *
   * Un UUID que genera el CLIENTE (no el servidor) antes de mandar la orden. La
   * restricción UNIQUE de la base es la que hace el trabajo de verdad: si por
   * doble clic en "comprar" llegan dos peticiones idénticas, la primera inserta
   * y la segunda choca contra este índice. En vez de crear una orden duplicada,
   * el servicio atrapa ese choque y devuelve la orden que ya existía.
   *
   * único lugar donde la comprobación es realmente atómica.
   */
  @Field()
  @Index('idx_ordenes_clave_idempotencia', { unique: true })
  @Column({ name: 'clave_idempotencia', type: 'uuid' })
  claveIdempotencia!: string;

  @Field(() => String, { nullable: true })
  @Column({ name: 'motivo', type: 'text', nullable: true })
  motivo!: string | null;

  @Field()
  @CreateDateColumn({ name: 'fecha', type: 'timestamptz' })
  fecha!: Date;

  @Field(() => [LineaOrden])
  @OneToMany(() => LineaOrden, (linea) => linea.orden, {
    eager: true,
    cascade: true,
  })
  lineas!: LineaOrden[];
}
