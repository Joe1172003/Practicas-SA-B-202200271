import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { UsuarioActual } from './decorators/usuario-actual.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtPayload } from './jwt-payload.interface';


@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly cookies: CookieService,) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async registrar( @Body() dto: RegisterDto,  @Res({ passthrough: true }) response: Response){
    const { perfil, token } = await this.auth.registrar(dto);

    this.cookies.establecerToken(response, token);

    return {
      mensaje: 'Cuenta creada correctamente',
      usuario: perfil,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { perfil, token } = await this.auth.login(dto);

    this.cookies.establecerToken(response, token);

    return {
      mensaje: 'Inicio de sesión correcto',
      usuario: perfil,
    };
  }

 
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response) {
    this.cookies.limpiarToken(response);
    return { mensaje: 'Sesión cerrada' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async miPerfil(@UsuarioActual() usuario: JwtPayload) {
    return { usuario: await this.auth.obtenerPerfil(usuario.sub) };
  }
}
