import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import {
  AuthenticatedRequest,
  OWNER_RESOURCE,
  PUBLIC_ROUTE,
} from './auth.decorators.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer (\S+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Bearer access token required');
    request.auth = await this.auth.authenticate(match[1]);
    const userId = request.auth.userId;
    // Existing API payloads retain userId, but it may only identify the caller.
    for (const input of [
      request.body as Record<string, unknown> | undefined,
      request.query,
    ]) {
      if (input?.userId !== undefined) {
        if (typeof input.userId !== 'string' || !isUUID(input.userId))
          throw new BadRequestException('Invalid userId');
        if (input.userId !== userId)
          throw new ForbiddenException('Cannot access another user');
      }
    }
    const resource = this.reflector.getAllAndOverride<{
      kind: 'user' | 'workout' | 'session';
      param: string;
    }>(OWNER_RESOURCE, [context.getHandler(), context.getClass()]);
    if (resource) {
      const id = request.params[resource.param];
      if (typeof id !== 'string' || !isUUID(id))
        throw new NotFoundException('Resource not found');
      if (resource.kind === 'user') {
        if (id !== userId) throw new NotFoundException('User not found');
      } else {
        const owned =
          resource.kind === 'workout'
            ? await this.prisma.db.orm.public.Workout.where({
                id,
                userId,
              }).first()
            : await this.prisma.db.orm.public.WorkoutSession.where({
                id,
                userId,
              }).first();
        if (!owned) throw new NotFoundException('Resource not found');
      }
    }
    return true;
  }
}
