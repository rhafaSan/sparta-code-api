/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { db } from '../src/prisma/db.js';
import { localWorkoutDay } from '../src/workouts/workout-schedule.service.js';
import {
  clearFixtureAuth,
  createFixtureUser,
  fixtureAccessToken,
} from './auth-helpers.js';

describe('Weekly workout schedule with PostgreSQL', () => {
  let app: INestApplication<App>;
  let token: string;
  const userId = randomUUID();
  const otherId = randomUUID();
  const workoutId = randomUUID();
  const secondId = randomUUID();
  const foreignId = randomUUID();
  const exerciseId = randomUUID();
  const base = '/workouts/schedule';
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const assign = (day: number, id: string = workoutId) =>
    request(app.getHttpServer())
      .put(`${base}/${day}`)
      .set(auth())
      .send({ workoutId: id });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    await createFixtureUser(userId, 'Schedule fixture');
    await createFixtureUser(otherId, 'Other owner');
    token = await fixtureAccessToken(app, userId);
    for (const [id, owner, name] of [
      [workoutId, userId, 'A'],
      [secondId, userId, 'B'],
      [foreignId, otherId, 'Private'],
    ])
      await db.orm.public.Workout.create({ id, userId: owner, name });
    await db.orm.public.Exercise.create({
      id: exerciseId,
      name: 'Schedule exercise',
    });
    for (const order of [2, 1])
      await db.orm.public.WorkoutExercise.create({
        workoutId,
        exerciseId,
        exerciseOrder: order,
        plannedSets: 3,
        plannedReps: 10,
      });
  });

  beforeEach(async () => {
    await db.orm.public.WorkoutSchedule.where({ userId }).deleteAll();
    await db.orm.public.Workout.where({ id: workoutId }).update({
      isActive: true,
    });
  });

  afterAll(async () => {
    try {
      await db.transaction(async (tx) => {
        await tx.orm.public.WorkoutSchedule.where({ userId }).deleteAll();
        const sessions = await tx.orm.public.WorkoutSession.where({
          userId,
        }).all();
        for (const session of sessions)
          await tx.orm.public.ExerciseSession.where({
            workoutSessionId: session.id,
          }).deleteAll();
        await tx.orm.public.WorkoutSession.where({ userId }).deleteAll();
        await tx.orm.public.WorkoutExercise.where({ workoutId }).deleteAll();
        for (const id of [workoutId, secondId, foreignId])
          await tx.orm.public.Workout.where({ id }).delete();
        await tx.orm.public.Exercise.where({ id: exerciseId }).delete();
        for (const id of [userId, otherId]) {
          await clearFixtureAuth(tx, id);
          await tx.orm.public.User.where({ id }).delete();
        }
      });
    } finally {
      if (app) await app.close();
      else await db.close();
    }
  });

  it('returns all seven days in ISO order with null on rest days', async () => {
    await assign(5).expect(200);
    await assign(1).expect(200);
    const result = await request(app.getHttpServer())
      .get(base)
      .set(auth())
      .expect(200);
    expect(
      (result.body as { dayOfWeek: number }[]).map((day) => day.dayOfWeek),
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(result.body[0].workoutId).toBe(workoutId);
    expect(result.body[4].workoutId).toBe(workoutId);
    expect(result.body[1].workout).toBeNull();
  });

  it('replaces one day without duplicating or changing other days', async () => {
    await assign(1).expect(200);
    await assign(2).expect(200);
    await assign(1, secondId).expect(200);
    const entries = await db.orm.public.WorkoutSchedule.where({ userId })
      .orderBy((entry) => entry.dayOfWeek.asc())
      .all();
    expect(entries.map((entry) => entry.workoutId)).toEqual([
      secondId,
      workoutId,
    ]);
  });

  it('serializes simultaneous assignments to an empty day', async () => {
    await Promise.all([assign(1).expect(200), assign(1, secondId).expect(200)]);
    const entries = await db.orm.public.WorkoutSchedule.where({
      userId,
      dayOfWeek: 1,
    }).all();
    expect(entries).toHaveLength(1);
    expect([workoutId, secondId]).toContain(entries[0].workoutId);
  });

  it('returns today with ordered exercises and respects time zones', async () => {
    for (let day = 1; day <= 7; day++) await assign(day).expect(200);
    for (const timeZone of ['America/Sao_Paulo', 'Asia/Tokyo']) {
      const expected = localWorkoutDay(new Date(), timeZone);
      const result = await request(app.getHttpServer())
        .get('/workouts/today')
        .query({ timeZone })
        .set(auth())
        .expect(200);
      expect(result.body).toMatchObject({ ...expected, timeZone, workoutId });
      expect(
        (
          result.body.workout.workoutExercises as { exerciseOrder: number }[]
        ).map((entry) => entry.exerciseOrder),
      ).toEqual([1, 2]);
    }
  });

  it('returns no workout on rest days and removes assignments idempotently', async () => {
    await assign(1).expect(200);
    for (let attempt = 0; attempt < 2; attempt++)
      await request(app.getHttpServer())
        .delete(`${base}/1`)
        .set(auth())
        .expect(200);
    const result = await request(app.getHttpServer())
      .get('/workouts/today')
      .set(auth())
      .expect(200);
    expect(result.body.workout).toBeNull();
    expect(result.body.timeZone).toBe('America/Sao_Paulo');
    expect(await db.orm.public.Workout.first({ id: workoutId })).not.toBeNull();
  });

  it('enforces authentication, ownership, weekday and time zone validation', async () => {
    await request(app.getHttpServer()).get(base).expect(401);
    await assign(1, foreignId).expect(404);
    await assign(1, randomUUID()).expect(404);
    await assign(1, 'invalid').expect(400);
    for (const day of ['0', '8', '-1', '1.5', 'monday'])
      await request(app.getHttpServer())
        .put(`${base}/${day}`)
        .set(auth())
        .send({ workoutId })
        .expect(400);
    await request(app.getHttpServer())
      .put(`${base}/1`)
      .set(auth())
      .send({ workoutId, userId: otherId })
      .expect(403);
    await request(app.getHttpServer())
      .get('/workouts/today')
      .query({ timeZone: 'invalid/zone' })
      .set(auth())
      .expect(400);
    expect(
      await db.orm.public.WorkoutSchedule.where({ userId }).all(),
    ).toHaveLength(0);
  });

  it('archival clears the weekly schedule while preserving session snapshots', async () => {
    await assign(1).expect(200);
    await assign(7).expect(200);
    const session = await request(app.getHttpServer())
      .post('/workout-sessions/start')
      .set(auth())
      .send({ userId, workoutId })
      .expect(201);
    const snapshots = session.body.exerciseSessions as {
      id: string;
      plannedSets: number;
      plannedReps: number;
    }[];
    await request(app.getHttpServer())
      .patch(`/workouts/${workoutId}`)
      .set(auth())
      .send({ isActive: false })
      .expect(200);
    expect(
      await db.orm.public.WorkoutSchedule.where({ userId }).all(),
    ).toHaveLength(0);
    await assign(1).expect(409);
    const history = await request(app.getHttpServer())
      .get(`/workout-sessions/${String(session.body.id)}`)
      .set(auth())
      .expect(200);
    for (const entry of snapshots)
      expect(history.body.exerciseSessions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: entry.id,
            plannedSets: entry.plannedSets,
            plannedReps: entry.plannedReps,
          }),
        ]),
      );
  });
});
