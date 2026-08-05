import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../common/role.enum';

// Esta entidad representa la tabla `users` en la base de datos. Cada instancia de `User` 
// corresponde a un registro en esa tabla. La clase define las columnas y sus tipos, así como las relaciones y restricciones.

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nombre_cifrado', type: 'text' })
  nombreCifrado: string;

  @Column({ name: 'correo_cifrado', type: 'text' })
  correoCifrado: string;

  @Index('idx_users_correo_indice', { unique: true })
  @Column({ name: 'correo_indice', type: 'varchar', length: 64 })
  correoIndice: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, default: Role.CLIENTE })
  rol: Role;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
