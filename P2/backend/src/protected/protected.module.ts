import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProtectedController } from './protected.controller';

/**
 * Importa AuthModule porque los guards que usa este controlador
 * (JwtAuthGuard y RolesGuard) se declaran y exportan allá.
 */
@Module({
  imports: [AuthModule],
  controllers: [ProtectedController],
})
export class ProtectedModule {}
