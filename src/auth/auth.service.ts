import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { LoginDto } from './dto/auth.dto.js';

const ACCESS_SECONDS = 15 * 60;
const IDLE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_SECONDS = 60 * 24 * 60 * 60;
export const tokenHash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const token = (prefix: string) =>
  `${prefix}_${randomBytes(32).toString('base64url')}`;
const after = (now: Temporal.Instant, seconds: number) => now.add({ seconds });

@Injectable()
export class AuthService {
  // Unknown emails still perform the expensive password verification.
  private readonly dummyHash = hashPassword(randomBytes(32).toString('hex'));

  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.db.orm.public.User.where({
      email: dto.email,
    }).first();
    const valid = await verifyPassword(
      dto.password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!user || !valid)
      throw new UnauthorizedException('Invalid email or password');
    const now = Temporal.Now.instant();
    const accessToken = token('at');
    const refreshToken = token('rt');
    await this.prisma.db.transaction(async (tx) => {
      const session = await tx.orm.public.AuthSession.create({
        userId: user.id,
        accessTokenHash: tokenHash(accessToken),
        accessExpiresAt: after(now, ACCESS_SECONDS),
        idleExpiresAt: after(now, IDLE_SECONDS),
        expiresAt: after(now, SESSION_SECONDS),
      });
      await tx.orm.public.RefreshToken.create({
        authSessionId: session.id,
        tokenHash: tokenHash(refreshToken),
      });
    });
    return {
      ...this.response(accessToken, refreshToken, after(now, IDLE_SECONDS)),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
    };
  }

  async refresh(refreshToken: string) {
    const result = await this.prisma.db.transaction(async (tx) => {
      const stored = await tx.orm.public.RefreshToken.where({
        tokenHash: tokenHash(refreshToken),
      }).first();
      if (!stored) return null;
      // All rotations, replay revocations and logouts take this row lock.
      const session = await tx.orm.public.AuthSession.where({
        id: stored.authSessionId,
      }).update({ id: stored.authSessionId });
      const now = Temporal.Now.instant();
      if (!session || session.revokedAt) return null;
      // Re-read after the lock: a concurrent request may have consumed it.
      const current = await tx.orm.public.RefreshToken.first({ id: stored.id });
      if (
        !current ||
        current.consumedAt ||
        Temporal.Instant.compare(session.expiresAt, now) <= 0 ||
        Temporal.Instant.compare(session.idleExpiresAt, now) <= 0
      ) {
        await tx.orm.public.AuthSession.where({ id: session.id }).update({
          revokedAt: now,
        });
        return null; // Commit revocation before raising 401 outside the transaction.
      }
      const accessToken = token('at');
      const nextRefreshToken = token('rt');
      const idleExpiresAt =
        Temporal.Instant.compare(after(now, IDLE_SECONDS), session.expiresAt) <
        0
          ? after(now, IDLE_SECONDS)
          : session.expiresAt;
      await tx.orm.public.RefreshToken.where({ id: current.id }).update({
        consumedAt: now,
      });
      await tx.orm.public.RefreshToken.create({
        authSessionId: session.id,
        tokenHash: tokenHash(nextRefreshToken),
      });
      await tx.orm.public.AuthSession.where({ id: session.id }).update({
        accessTokenHash: tokenHash(accessToken),
        accessExpiresAt: after(now, ACCESS_SECONDS),
        idleExpiresAt,
      });
      return this.response(accessToken, nextRefreshToken, idleExpiresAt);
    });
    if (!result)
      throw new UnauthorizedException('Invalid or expired refresh token');
    return result;
  }

  async logout(refreshToken: string) {
    await this.prisma.db.transaction(async (tx) => {
      const stored = await tx.orm.public.RefreshToken.where({
        tokenHash: tokenHash(refreshToken),
      }).first();
      if (!stored) return;
      await tx.orm.public.AuthSession.where({
        id: stored.authSessionId,
      }).update({ revokedAt: Temporal.Now.instant() });
    });
  }

  async authenticate(accessToken: string) {
    if (!/^at_[A-Za-z0-9_-]{43}$/.test(accessToken))
      throw new UnauthorizedException('Invalid access token');
    const session = await this.prisma.db.orm.public.AuthSession.where({
      accessTokenHash: tokenHash(accessToken),
    }).first();
    const now = Temporal.Now.instant();
    if (
      !session ||
      session.revokedAt ||
      [session.accessExpiresAt, session.idleExpiresAt, session.expiresAt].some(
        (expiry) => Temporal.Instant.compare(expiry, now) <= 0,
      )
    ) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    return { userId: session.userId, sessionId: session.id };
  }

  private response(
    accessToken: string,
    refreshToken: string,
    refreshExpiresAt: Temporal.Instant,
  ) {
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_SECONDS,
      refreshExpiresAt,
    };
  }
}
