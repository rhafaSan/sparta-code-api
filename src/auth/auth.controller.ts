import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from '../users/users.service.js';
import { CurrentUserId, Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { LoginDto, RefreshTokenDto } from './dto/auth.dto.js';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Autenticar com e-mail e senha' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Renovar a sessão e rotacionar os dois tokens' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Revogar a sessão usando seu refresh token' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Consultar o usuário autenticado' })
  me(@CurrentUserId() id: string) {
    return this.users.get(id);
  }
}
