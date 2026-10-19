import { randomBytes, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { AuthRateLimitGuard } from '../src/auth/auth-rate-limit.guard.js';
import { tokenHash } from '../src/auth/auth.service.js';
import { verifyPassword } from '../src/auth/password.js';
import { db } from '../src/prisma/db.js';
import {
  clearFixtureAuth,
  credentials,
  fixturePassword,
} from './auth-helpers.js';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresAt: string;
}
interface PublicUser {
  id: string;
  email: string;
  username: string;
  name: string;
}

describe('Authentication with PostgreSQL', () => {
  let app: INestApplication<App>;
  let user: PublicUser;
  let other: PublicUser;
  const first = { name: 'Auth fixture', ...credentials(randomUUID()) };
  const second = { name: 'Other fixture', ...credentials(randomUUID()) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AuthRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    try {
      await db.transaction(async (tx) => {
        for (const fixture of [user, other].filter(Boolean)) {
          await clearFixtureAuth(tx, fixture.id);
          await tx.orm.public.User.where({ id: fixture.id }).delete();
        }
      });
    } finally {
      await app.close();
    }
  });

  async function login(input = first): Promise<Tokens> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: input.email, password: input.password })
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).not.toHaveProperty('passwordHash');
    return response.body as Tokens;
  }
  const me = (tokens: Tokens) =>
    request(app.getHttpServer())
      .get('/auth/me')
      .auth(tokens.accessToken, { type: 'bearer' });
  const refresh = (tokens: Tokens) =>
    request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken });

  it('requires bearer authentication on data routes and leaves health public', async () => {
    await request(app.getHttpServer()).get('/').expect(200);
    for (const path of [
      '/users',
      '/exercises',
      '/workouts',
      '/workout-sessions',
      '/auth/me',
    ])
      await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .auth('invalid', { type: 'bearer' })
      .expect(401);
  });

  it('requires email, username and password, normalizes identity, and returns no hash', async () => {
    for (const input of [
      { name: 'Missing credentials' },
      { ...first, password: 'short' },
      { ...first, password: ' '.repeat(8) },
      { ...first, password: 'x'.repeat(129) },
      { ...first, email: 'invalid' },
      { ...first, username: 'invalid username' },
      { ...first, password: null },
      { ...first, passwordHash: 'injected' },
    ])
      await request(app.getHttpServer()).post('/users').send(input).expect(400);
    const created = await request(app.getHttpServer())
      .post('/users')
      .send({
        ...first,
        email: ` ${first.email.toUpperCase()} `,
        username: ` ${first.username.toUpperCase()} `,
      })
      .expect(201);
    user = created.body as PublicUser;
    expect(user).toMatchObject({
      email: first.email,
      username: first.username,
    });
    expect(created.body).not.toHaveProperty('passwordHash');
    expect(created.body).not.toHaveProperty('password');
    const stored = await db.orm.public.User.first({ id: user.id });
    expect(stored!.passwordHash).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(await verifyPassword(fixturePassword, stored!.passwordHash)).toBe(
      true,
    );
    other = (
      await request(app.getHttpServer()).post('/users').send(second).expect(201)
    ).body as PublicUser;
    await request(app.getHttpServer())
      .post('/users')
      .send({ ...second, email: first.email.toUpperCase() })
      .expect(409);
    await request(app.getHttpServer())
      .post('/users')
      .send({
        ...second,
        email: `${randomUUID()}@example.com`,
        username: first.username.toUpperCase(),
      })
      .expect(409);
  });

  it('authenticates by normalized email only and uses a generic invalid-credentials error', async () => {
    const wrong = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: first.email, password: 'incorrect' })
      .expect(401);
    const unknown = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'absent@example.com', password: first.password })
      .expect(401);
    expect(wrong.body).toEqual(unknown.body);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: first.username, password: first.password })
      .expect(400);
    const tokens = await login({
      ...first,
      email: ` ${first.email.toUpperCase()} `,
    });
    expect(tokens).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    const profile = await me(tokens).expect(200);
    expect(profile.body).toMatchObject({ id: user.id });
    const stored = await db.orm.public.AuthSession.where({
      userId: user.id,
      accessTokenHash: tokenHash(tokens.accessToken),
    }).first();
    expect(stored!.accessTokenHash).not.toBe(tokens.accessToken);
    const storedRefresh = await db.orm.public.RefreshToken.where({
      authSessionId: stored!.id,
    }).first();
    expect(storedRefresh!.tokenHash).toBe(tokenHash(tokens.refreshToken));
    await request(app.getHttpServer())
      .get('/auth/me')
      .auth(tokens.refreshToken, { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: tokens.accessToken })
      .expect(400);
  });

  it('isolates users, workouts, history and mutations', async () => {
    const tokens = await login();
    const otherTokens = await login(second);
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };
    const own = await request(app.getHttpServer())
      .get('/users')
      .set(auth)
      .expect(200);
    expect(own.body).toHaveLength(1);
    expect((own.body as PublicUser[])[0].id).toBe(user.id);
    expect(JSON.stringify(own.body)).not.toContain('password');
    await request(app.getHttpServer())
      .get(`/users/${other.id}`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/users/${other.id}`)
      .set(auth)
      .send({ name: 'Hijack' })
      .expect(404);
    await request(app.getHttpServer())
      .post('/workouts')
      .set(auth)
      .send({ userId: other.id, name: 'Hijack' })
      .expect(403);
    for (const path of [
      `/workouts?userId=${other.id}`,
      `/workout-sessions?userId=${other.id}`,
    ])
      await request(app.getHttpServer()).get(path).set(auth).expect(403);
    // API guards need committed rows; cleanup below touches only these fixtures.
    const workout = await db.orm.public.Workout.create({
      userId: other.id,
      name: 'Private workout',
    });
    const session = await db.orm.public.WorkoutSession.create({
      userId: other.id,
      workoutId: workout.id,
    });
    try {
      await request(app.getHttpServer())
        .get(`/workouts/${workout.id}`)
        .set(auth)
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/workouts/${workout.id}`)
        .set(auth)
        .send({ name: 'Hijack' })
        .expect(404);
      await request(app.getHttpServer())
        .post(`/workouts/${workout.id}/exercises`)
        .set(auth)
        .send({})
        .expect(404);
      await request(app.getHttpServer())
        .get(`/workout-sessions/${session.id}`)
        .set(auth)
        .expect(404);
      await request(app.getHttpServer())
        .get(`/workout-sessions/${session.id}/share-summary`)
        .set(auth)
        .expect(404);
      await request(app.getHttpServer())
        .post(`/workout-sessions/${session.id}/finish`)
        .set(auth)
        .send({})
        .expect(404);
      await request(app.getHttpServer())
        .get(`/workouts/${workout.id}`)
        .auth(otherTokens.accessToken, { type: 'bearer' })
        .expect(200);
    } finally {
      await db.orm.public.WorkoutSession.where({ id: session.id }).delete();
      await db.orm.public.Workout.where({ id: workout.id }).delete();
    }
  });

  it('rotates both tokens and revokes only that session on reuse', async () => {
    const initial = await login();
    const independent = await login();
    const rotated = (await refresh(initial).expect(200)).body as Tokens;
    expect(rotated.accessToken).not.toBe(initial.accessToken);
    expect(rotated.refreshToken).not.toBe(initial.refreshToken);
    await me(initial).expect(401);
    await me(rotated).expect(200);
    await refresh(initial).expect(401);
    await me(rotated).expect(401);
    await refresh(rotated).expect(401);
    await me(independent).expect(200);
  });

  it('serializes concurrent rotations and commits replay revocation', async () => {
    const initial = await login();
    const responses = await Promise.all([refresh(initial), refresh(initial)]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 401,
    ]);
    const winner = responses.find((response) => response.status === 200)!
      .body as Tokens;
    await me(winner).expect(401);
    await refresh(winner).expect(401);
  });

  it('allows refresh after access expiry, rejects expired sessions and caps renewal at 60 days', async () => {
    const initial = await login();
    const session = await db.orm.public.AuthSession.where({
      accessTokenHash: tokenHash(initial.accessToken),
    }).first();
    const now = Temporal.Now.instant();
    await db.orm.public.AuthSession.where({ id: session!.id }).update({
      accessExpiresAt: now.subtract({ seconds: 1 }),
      expiresAt: now.add({ hours: 24 }),
    });
    await me(initial).expect(401);
    const rotated = (await refresh(initial).expect(200)).body as Tokens;
    expect(
      Temporal.Instant.from(rotated.refreshExpiresAt).epochMilliseconds,
    ).toBe(now.add({ hours: 24 }).epochMilliseconds);
    await db.orm.public.AuthSession.where({ id: session!.id }).update({
      idleExpiresAt: now.subtract({ seconds: 1 }),
    });
    await refresh(rotated).expect(401);
    const absolute = await login();
    await db.orm.public.AuthSession.where({
      accessTokenHash: tokenHash(absolute.accessToken),
    }).update({ expiresAt: now.subtract({ seconds: 1 }) });
    await me(absolute).expect(401);
    await refresh(absolute).expect(401);
  });

  it('logs out idempotently even after access expiry and rejects unknown refresh tokens', async () => {
    const initial = await login();
    const rotated = (await refresh(initial).expect(200)).body as Tokens;
    await db.orm.public.AuthSession.where({
      accessTokenHash: tokenHash(rotated.accessToken),
    }).update({
      accessExpiresAt: Temporal.Now.instant().subtract({ seconds: 1 }),
    });
    await me(rotated).expect(401);
    // A previous token can still revoke its own family.
    for (let i = 0; i < 2; i++)
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: initial.refreshToken })
        .expect(204);
    await me(rotated).expect(401);
    await refresh(rotated).expect(401);
    const unknown = {
      ...initial,
      refreshToken: `rt_${randomBytes(32).toString('base64url')}`,
    };
    await refresh(unknown).expect(401);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: unknown.refreshToken })
      .expect(204);
  });
});
