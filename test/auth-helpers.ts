import type { INestApplication } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service.js';
import { hashPassword } from '../src/auth/password.js';
import { db, type Transaction } from '../src/prisma/db.js';

export const fixturePassword = 'Test-password-42';
export function credentials(id: string) {
  return {
    email: `${id}@example.com`,
    username: id.replaceAll('-', '').slice(0, 30),
    password: fixturePassword,
  };
}

export async function createFixtureUser(
  id: string,
  name: string,
  tx?: Transaction,
) {
  const { email, username } = credentials(id);
  return (tx ?? db).orm.public.User.create({
    id,
    name,
    email,
    username,
    passwordHash: await hashPassword(fixturePassword),
  });
}

export async function fixtureAccessToken(app: INestApplication, id: string) {
  return (await app.get(AuthService).login(credentials(id))).accessToken;
}

export async function clearFixtureAuth(tx: Transaction, userId: string) {
  const sessions = await tx.orm.public.AuthSession.where({ userId }).all();
  for (const session of sessions)
    await tx.orm.public.RefreshToken.where({
      authSessionId: session.id,
    }).deleteAll();
  await tx.orm.public.AuthSession.where({ userId }).deleteAll();
}
