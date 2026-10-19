import type { ExecutionContext } from '@nestjs/common';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';

describe('Auth rate limiter', () => {
  const context = (ip: string) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ ip }) }),
    }) as ExecutionContext;

  it('limits a client while allowing another IP', () => {
    const guard = new AuthRateLimitGuard();
    for (let i = 0; i < 20; i++)
      expect(guard.canActivate(context('127.0.0.1'))).toBe(true);
    expect(() => guard.canActivate(context('127.0.0.1'))).toThrow(
      'Too many requests',
    );
    expect(guard.canActivate(context('127.0.0.2'))).toBe(true);
  });
});
