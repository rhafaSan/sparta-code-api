import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';

export const PUBLIC_ROUTE = 'auth:public';
export const OWNER_RESOURCE = 'auth:owner';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const OwnResource = (
  kind: 'user' | 'workout' | 'session',
  param: string,
) => SetMetadata(OWNER_RESOURCE, { kind, param });

export interface AuthenticatedRequest extends Request {
  auth: { userId: string; sessionId: string };
}

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().auth.userId,
);
