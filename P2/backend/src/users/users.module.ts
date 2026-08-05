import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '../crypto/crypto.module';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), CryptoModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
