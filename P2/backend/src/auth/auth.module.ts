import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { cookieConfig } from '../config/cookie.config';
import { jwtConfig } from '../config/jwt.config';
import type { JwtConfig } from '../config/jwt.config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TokenService } from './token.service';

@Module({
  imports: [
    UsersModule,
    ConfigModule.forFeature(jwtConfig),
    ConfigModule.forFeature(cookieConfig),

    /**
     * `registerAsync` porque el secreto no se conoce hasta que la
     * configuración esté cargada y validada. La versión síncrona leería
     * process.env demasiado pronto.
     */
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(jwtConfig)],
      inject: [jwtConfig.KEY],
      useFactory: (config: JwtConfig) => ({
        secret: config.secret,

        // Fijar el algoritmo al firmar Y al verificar cierra el ataque de
        // "confusión de algoritmo": alguien manda un token diciendo que usa
        // otro algoritmo (o ninguno) para que la firma no se compruebe de
        // verdad. Al exigir HS256 en ambos lados, cualquier token que declare
        // otra cosa se rechaza sin más.
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    CookieService,
    JwtAuthGuard,
    RolesGuard,
  ],

  // Se exportan los guards para que otros módulos puedan proteger sus rutas
  // sin volver a declararlos.
  exports: [TokenService, CookieService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
