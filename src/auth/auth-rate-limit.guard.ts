import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<
    string,
    { count: number; expires: number }
  >();

  canActivate(context: ExecutionContext): boolean {
    const now = Date.now();
    for (const [key, bucket] of this.attempts) {
      if (bucket.expires <= now) this.attempts.delete(key);
    }
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip ?? 'unknown';
    let bucket = this.attempts.get(key);
    if (!bucket) {
      if (this.attempts.size >= 10000)
        throw new HttpException('Too many requests', 429);
      bucket = { count: 0, expires: now + 60000 };
      this.attempts.set(key, bucket);
    }
    if (++bucket.count > 20)
      throw new HttpException(
        'Too many requests. Try again in one minute.',
        429,
      );
    return true;
  }
}
