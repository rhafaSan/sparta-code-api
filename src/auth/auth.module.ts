import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRateLimitGuard,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
