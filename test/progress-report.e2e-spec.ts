import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { db } from '../src/prisma/db.js';
import type { ProgressReport } from '../src/workout-sessions/dto/progress-report.dto.js';
import {
  clearFixtureAuth,
  createFixtureUser,
  fixtureAccessToken,
} from './auth-helpers.js';

describe('Progress report with PostgreSQL', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  const userIds = [randomUUID(), randomUUID()];
  const workoutIds = [randomUUID(), randomUUID(), randomUUID()];
  const exerciseIds = [randomUUID(), randomUUID()];
  const url = '/workout-sessions/progress-report';
  const query = { startDate: '2026-09-07', endDate: '2026-10-04' };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    await db.transaction(async (tx) => {
      for (const id of userIds) await createFixtureUser(id, 'Report test', tx);
      for (const [index, id] of exerciseIds.entries())
        await tx.orm.public.Exercise.create({
          id,
          name: `Report ${index}`,
          isActive: false,
        });
      for (const [index, id] of workoutIds.entries())
        await tx.orm.public.Workout.create({
          id,
          userId: userIds[index === 1 ? 1 : 0],
          name: 'Archived report workout',
          isActive: false,
        });
      for (const [index, workoutId] of workoutIds.slice(0, 2).entries()) {
        const entries: { id: string; exerciseOrder: number }[] = [];
        for (let order = 1; order <= 3; order++)
          entries.push(
            await tx.orm.public.WorkoutExercise.create({
              workoutId,
              exerciseId: exerciseIds[order === 3 ? 1 : 0],
              exerciseOrder: order,
              plannedSets: 50,
              plannedReps: 99,
              isActive: false,
            }),
          );
        const fixtures = [
          {
            date: '2026-09-07T03:00:00Z',
            weight: '80.25',
            reps: 10,
            finished: true,
          },
          {
            date: '2026-10-05T02:59:59.999999Z',
            weight: '90.28125',
            reps: 12,
            finished: true,
          },
          {
            date: '2026-09-07T02:59:59Z',
            weight: '999',
            reps: 999,
            finished: true,
          },
          {
            date: '2026-10-05T03:00:00Z',
            weight: '999',
            reps: 999,
            finished: true,
          },
          {
            date: '2026-09-21T12:00:00Z',
            weight: '999',
            reps: 999,
            finished: false,
          },
        ];
        for (const [fixtureIndex, fixture] of fixtures.entries()) {
          const startedAt = Temporal.Instant.from(fixture.date);
          const session = await tx.orm.public.WorkoutSession.create({
            userId: userIds[index],
            workoutId,
            startedAt,
            finishedAt: fixture.finished ? startedAt.add({ hours: 1 }) : null,
          });
          for (const [entryIndex, entry] of entries.entries()) {
            if (entryIndex === 1 && fixtureIndex !== 0) continue;
            const execution = await tx.orm.public.ExerciseSession.create({
              workoutSessionId: session.id,
              workoutExerciseId: entry.id,
              exerciseOrder: entry.exerciseOrder,
              plannedSets: 4,
              plannedReps: 10,
            });
            await tx.orm.public.ExerciseSet.create({
              exerciseSessionId: execution.id,
              setNumber: 1,
              weight:
                entryIndex === 0
                  ? fixture.weight
                  : entryIndex === 1
                    ? '70'
                    : '100',
              reps: entryIndex === 0 ? fixture.reps : entryIndex === 1 ? 8 : 1,
              completed: true,
            });
            await tx.orm.public.ExerciseSet.create({
              exerciseSessionId: execution.id,
              setNumber: 2,
              weight: '9999',
              reps: 9999,
              completed: false,
            });
          }
        }
      }
    });
    accessToken = await fixtureAccessToken(app, userIds[0]);
  });

  afterAll(async () => {
    try {
      await db.transaction(async (tx) => {
        for (const userId of userIds) {
          const sessions = await tx.orm.public.WorkoutSession.where({
            userId,
          }).all();
          for (const session of sessions) {
            const executions = await tx.orm.public.ExerciseSession.where({
              workoutSessionId: session.id,
            }).all();
            for (const execution of executions)
              await tx.orm.public.ExerciseSet.where({
                exerciseSessionId: execution.id,
              }).deleteAll();
            await tx.orm.public.ExerciseSession.where({
              workoutSessionId: session.id,
            }).deleteAll();
          }
          await tx.orm.public.WorkoutSession.where({ userId }).deleteAll();
          const workouts = await tx.orm.public.Workout.where({ userId }).all();
          for (const workout of workouts)
            await tx.orm.public.WorkoutExercise.where({
              workoutId: workout.id,
            }).deleteAll();
          await tx.orm.public.Workout.where({ userId }).deleteAll();
          await clearFixtureAuth(tx, userId);
          await tx.orm.public.User.where({ id: userId }).delete();
        }
        for (const id of exerciseIds)
          await tx.orm.public.Exercise.where({ id }).delete();
      });
    } finally {
      if (app) await app.close();
      else await db.close();
    }
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get(url).query(query).expect(401);
  });

  it('reports actual completed sets with inclusive local dates, archived definitions and no other user data', async () => {
    const before = await db.orm.public.WorkoutSession.where({
      userId: userIds[0],
    }).all();
    const response = await request(app.getHttpServer())
      .get(url)
      .query(query)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const report = response.body as ProgressReport;
    expect(report.userId).toBe(userIds[0]);
    expect(report.totals).toEqual({
      workoutSessions: 2,
      completedSets: 5,
      totalReps: '32',
      averageReps: '6.40',
      maxWeight: '100',
    });
    expect(report.exercises).toHaveLength(2);
    const exercise = report.exercises.find(
      (item) => item.exerciseId === exerciseIds[0],
    )!;
    expect(exercise.totals).toMatchObject({
      completedSets: 3,
      totalReps: '30',
      maxWeight: '90.28125',
    });
    expect(exercise.progression).toEqual({
      fromPeriodStart: '2026-09-07',
      toPeriodStart: '2026-09-28',
      weightPercent: '12.50',
      repsPercent: '33.33',
    });
    expect(
      exercise.periods.map((period) => period.metrics.completedSets),
    ).toEqual([2, 0, 0, 1]);
    expect(
      await db.orm.public.WorkoutSession.where({ userId: userIds[0] }).all(),
    ).toEqual(before);
  });

  it('supports monthly grouping, exercise and workout filters', async () => {
    const response = await request(app.getHttpServer())
      .get(url)
      .query({
        ...query,
        groupBy: 'month',
        exerciseId: exerciseIds[0],
        workoutId: workoutIds[0],
      })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const report = response.body as ProgressReport;
    expect(report.periods).toEqual([
      { startDate: '2026-09-07', endDate: '2026-09-30' },
      { startDate: '2026-10-01', endDate: '2026-10-04' },
    ]);
    expect(report.exercises).toHaveLength(1);
    expect(report.totals.completedSets).toBe(3);
    const empty = await request(app.getHttpServer())
      .get(url)
      .query({ ...query, workoutId: workoutIds[2] })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect((empty.body as ProgressReport).exercises).toEqual([]);
    expect((empty.body as ProgressReport).totals.completedSets).toBe(0);
  });

  it.each([
    {},
    { ...query, startDate: '2026-02-30' },
    { ...query, endDate: '2026-09-01' },
    { ...query, startDate: '2026-09-07T00:00:00Z' },
    { ...query, groupBy: 'year' },
    { ...query, timeZone: 'Invalid/zone' },
    { ...query, workoutId: 'invalid' },
    { ...query, exerciseId: 'invalid' },
    { ...query, limit: 1 },
  ])('rejects invalid or unknown query fields: %j', async (invalid) => {
    await request(app.getHttpServer())
      .get(url)
      .query(invalid)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('returns 404 for missing resources or another user workout', async () => {
    for (const filter of [
      { workoutId: workoutIds[1] },
      { workoutId: randomUUID() },
      { exerciseId: randomUUID() },
    ])
      await request(app.getHttpServer())
        .get(url)
        .query({ ...query, ...filter })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
  });
});
