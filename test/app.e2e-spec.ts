/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { db } from '../src/prisma/db.js';
import type { Transaction } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { WorkoutsService } from '../src/workouts/workouts.service.js';
import { WorkoutSessionsService } from '../src/workout-sessions/workout-sessions.service.js';
import { seedExercises } from '../src/prisma/seed-exercises.js';
import {
  catalogExercises,
  catalogExerciseIds,
} from '../src/exercises/exercise-catalog.js';

interface Row {
  id: string;
  name: string;
  isActive: boolean;
}
interface Entry extends Row {
  restSeconds: number | null;
  exerciseOrder: number;
  plannedSets: number;
  plannedReps: number;
}
interface SetResult {
  id: string;
  setNumber: number;
  weight: string;
  reps: number;
  completed: boolean;
}
interface Execution extends Entry {
  completed: boolean;
  sets: SetResult[];
}
interface Session extends Row {
  exerciseSessions: Execution[];
  finishedAt: string | null;
  durationSeconds: number | null;
}

describe('Workout flow with PostgreSQL', () => {
  let app: INestApplication<App>;
  const userIds: string[] = [];
  const exerciseIds: string[] = [];
  let user: Row;
  let otherUser: Row;
  let exercise: Row;
  let workout: Row;
  let first: Entry;
  let second: Entry;
  let session: Session;
  const prefix = `e2e-${randomUUID()}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // Only delete fixtures created by this suite, in dependency order.
    try {
      await db.transaction(async (tx) => {
        for (const userId of userIds) {
          const sessions = await tx.orm.public.WorkoutSession.where({
            userId,
          }).all();
          for (const recorded of sessions) {
            const executions = await tx.orm.public.ExerciseSession.where({
              workoutSessionId: recorded.id,
            }).all();
            for (const execution of executions)
              await tx.orm.public.ExerciseSet.where({
                exerciseSessionId: execution.id,
              }).deleteAll();
            await tx.orm.public.ExerciseSession.where({
              workoutSessionId: recorded.id,
            }).deleteAll();
          }
          await tx.orm.public.WorkoutSession.where({ userId }).deleteAll();
          const workouts = await tx.orm.public.Workout.where({ userId }).all();
          for (const template of workouts)
            await tx.orm.public.WorkoutExercise.where({
              workoutId: template.id,
            }).deleteAll();
          await tx.orm.public.Workout.where({ userId }).deleteAll();
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

  it('seeds the catalog idempotently and preserves edited, archived and custom exercises', async () => {
    const rollback = new Error('Rollback isolated catalog test');
    await expect(
      db.transaction(async (tx) => {
        const database = {
          transaction: async <R>(
            callback: (transaction: Transaction) => PromiseLike<R>,
          ): Promise<R> => await callback(tx),
        };
        await seedExercises(database);
        const rows = await tx.orm.public.Exercise.where((e) =>
          e.id.in(catalogExerciseIds),
        ).all();
        expect(rows).toHaveLength(catalogExercises.length);
        const entry = catalogExercises[0];
        await tx.orm.public.Exercise.where({ id: entry.id }).update({
          name: 'Edited catalog name',
          isActive: false,
        });
        const custom = await tx.orm.public.Exercise.create({
          name: `${prefix}-custom`,
        });
        const before = await tx.orm.public.Exercise.aggregate((a) => ({
          count: a.count(),
        }));
        await seedExercises(database);
        expect(
          await tx.orm.public.Exercise.aggregate((a) => ({ count: a.count() })),
        ).toEqual(before);
        expect(
          await tx.orm.public.Exercise.first({ id: entry.id }),
        ).toMatchObject({ name: 'Edited catalog name', isActive: false });
        expect(
          await tx.orm.public.Exercise.first({ id: custom.id }),
        ).toMatchObject({ name: custom.name });
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });

  it('rejects invalid DTOs, identifiers and unknown fields', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ name: '  ' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'User', email: 'unexpected' })
      .expect(400);
    await request(app.getHttpServer()).get('/exercises/not-a-uuid').expect(400);
    await request(app.getHttpServer())
      .get(`/exercises/${randomUUID()}`)
      .expect(404);
    await request(app.getHttpServer()).get('/exercises?limit=0').expect(400);
    await request(app.getHttpServer())
      .get('/exercises?includeArchived=banana')
      .expect(400);
    await request(app.getHttpServer()).get('/workouts').expect(400);
  });

  it('creates users, a reusable exercise and a workout', async () => {
    user = (
      await request(app.getHttpServer())
        .post('/users')
        .send({ name: prefix })
        .expect(201)
    ).body as Row;
    userIds.push(user.id);
    otherUser = (
      await request(app.getHttpServer())
        .post('/users')
        .send({ name: `${prefix}-other` })
        .expect(201)
    ).body as Row;
    userIds.push(otherUser.id);
    exercise = (
      await request(app.getHttpServer())
        .post('/exercises')
        .send({ name: `${prefix}-press`, muscleGroup: 'Peito' })
        .expect(201)
    ).body as Row;
    exerciseIds.push(exercise.id);
    workout = (
      await request(app.getHttpServer())
        .post('/workouts')
        .send({ userId: user.id, name: prefix })
        .expect(201)
    ).body as Row;
    await request(app.getHttpServer())
      .post('/workouts')
      .send({ userId: randomUUID(), name: prefix })
      .expect(404);
  });

  it('searches exercises with combined filters, pagination and literal wildcard handling', async () => {
    const search = (
      query: Record<string, string | number | boolean | undefined>,
    ) => request(app.getHttpServer()).get('/exercises').query(query);
    const found = await search({
      q: `${prefix}-PRESS`,
      muscleGroup: 'peito',
    }).expect(200);
    expect(found.body).toEqual([expect.objectContaining({ id: exercise.id })]);
    expect(
      (await search({ q: prefix, muscleGroup: 'Costas' }).expect(200)).body,
    ).toEqual([]);
    expect(
      (await search({ q: prefix, catalogOnly: true }).expect(200)).body,
    ).toEqual([]);
    expect((await search({ q: prefix, offset: 1 }).expect(200)).body).toEqual(
      [],
    );
    expect((await search({ q: `${prefix}%` }).expect(200)).body).toEqual([]);
    expect((await search({ q: `${prefix}_` }).expect(200)).body).toEqual([]);
    for (const query of [
      { q: '   ' },
      { muscleGroup: '   ' },
      { catalogOnly: 'invalid' },
      { q: 'a'.repeat(201) },
    ])
      await search(query).expect(400);
    await request(app.getHttpServer())
      .patch(`/exercises/${exercise.id}`)
      .send({ isActive: false })
      .expect(200);
    expect((await search({ q: prefix }).expect(200)).body).toEqual([]);
    expect(
      (await search({ q: prefix, includeArchived: true }).expect(200)).body,
    ).toEqual([expect.objectContaining({ id: exercise.id })]);
    await request(app.getHttpServer())
      .patch(`/exercises/${exercise.id}`)
      .send({ isActive: true })
      .expect(200);
  });

  it('allows repeated exercises, rejects duplicate order and supports swapping', async () => {
    const endpoint = `/workouts/${workout.id}/exercises`;
    first = (
      await request(app.getHttpServer())
        .post(endpoint)
        .send({
          exerciseId: exercise.id,
          exerciseOrder: 1,
          plannedSets: 4,
          plannedReps: 10,
          restSeconds: 90,
        })
        .expect(201)
    ).body as Entry;
    second = (
      await request(app.getHttpServer())
        .post(endpoint)
        .send({
          exerciseId: exercise.id,
          exerciseOrder: 2,
          plannedSets: 3,
          plannedReps: 8,
        })
        .expect(201)
    ).body as Entry;
    await request(app.getHttpServer())
      .post(endpoint)
      .send({
        exerciseId: exercise.id,
        exerciseOrder: 1,
        plannedSets: 4,
        plannedReps: 10,
      })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`${endpoint}/${first.id}`)
      .send({ plannedSets: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`${endpoint}/${first.id}`)
      .send({ plannedSets: null })
      .expect(400);
    await request(app.getHttpServer())
      .put(`${endpoint}/order`)
      .send({ workoutExerciseIds: [first.id] })
      .expect(409);
    const result = (
      await request(app.getHttpServer())
        .put(`${endpoint}/order`)
        .send({ workoutExerciseIds: [second.id, first.id] })
        .expect(200)
    ).body as Entry[];
    expect(result.map((e) => [e.id, e.exerciseOrder])).toEqual([
      [second.id, 1],
      [first.id, 2],
    ]);
  });

  it('rolls back the session and first snapshot when the second snapshot fails', async () => {
    const failure = new Error(
      'Injected failure while creating the second snapshot',
    );
    let attempts = 0;
    const failingPrisma = {
      db: {
        ...db,
        transaction: <R>(
          callback: (tx: Transaction) => PromiseLike<R>,
        ): Promise<R> =>
          db.transaction(async (tx) => {
            const collection = tx.orm.public.ExerciseSession;
            const failingCollection = new Proxy(collection, {
              get(target, key, receiver) {
                if (key === 'create')
                  return async (
                    data: Parameters<typeof collection.create>[0],
                  ) => {
                    attempts += 1;
                    if (attempts === 2) throw failure;
                    return collection.create(data);
                  };
                return Reflect.get(target, key, receiver) as unknown;
              },
            });
            return await callback({
              ...tx,
              orm: {
                ...tx.orm,
                public: {
                  User: tx.orm.public.User,
                  Exercise: tx.orm.public.Exercise,
                  Workout: tx.orm.public.Workout,
                  WorkoutExercise: tx.orm.public.WorkoutExercise,
                  WorkoutSession: tx.orm.public.WorkoutSession,
                  ExerciseSet: tx.orm.public.ExerciseSet,
                  ExerciseSession: failingCollection,
                },
              },
            });
          }),
      },
    } as unknown as PrismaService;
    const service = new WorkoutSessionsService(
      failingPrisma,
      app.get(WorkoutsService),
    );
    await expect(
      service.start({ userId: user.id, workoutId: workout.id }),
    ).rejects.toThrow(failure);
    expect(attempts).toBe(2);
    expect(
      await db.orm.public.WorkoutSession.where({ userId: user.id }).all(),
    ).toEqual([]);
    expect(
      await db.orm.public.ExerciseSession.where((e) =>
        e.workoutExercise.some({ workoutId: workout.id }),
      ).all(),
    ).toEqual([]);
  });

  it('starts a session with immutable snapshots and rejects another owner', async () => {
    await request(app.getHttpServer())
      .post('/workout-sessions/start')
      .send({ userId: otherUser.id, workoutId: workout.id })
      .expect(404);
    session = (
      await request(app.getHttpServer())
        .post('/workout-sessions/start')
        .send({ userId: user.id, workoutId: workout.id })
        .expect(201)
    ).body as Session;
    expect(session.exerciseSessions.map((e) => e.restSeconds)).toEqual([
      null,
      90,
    ]);
    expect(
      session.exerciseSessions.map((e) => [
        e.exerciseOrder,
        e.plannedSets,
        e.plannedReps,
      ]),
    ).toEqual([
      [1, 3, 8],
      [2, 4, 10],
    ]);
    await request(app.getHttpServer())
      .patch(`/workouts/${workout.id}/exercises/${first.id}`)
      .send({ plannedSets: 5, plannedReps: 6, restSeconds: 120 })
      .expect(200);
    const historic = (
      await request(app.getHttpServer())
        .get(`/workout-sessions/${session.id}`)
        .expect(200)
    ).body as Session;
    expect(historic.exerciseSessions[1]).toMatchObject({
      restSeconds: 90,
      plannedSets: 4,
      plannedReps: 10,
    });
    expect(historic.durationSeconds).toBeNull();
  });

  it('validates rest settings and changes only the ongoing execution', async () => {
    const templatePath = `/workouts/${workout.id}/exercises/${first.id}`;
    const executionPath = `/workout-sessions/${session.id}/exercises/${session.exerciseSessions[1].id}`;
    for (const restSeconds of [-1, 1.5, '90', true, 2147483648]) {
      await request(app.getHttpServer())
        .post(`/workouts/${workout.id}/exercises`)
        .send({
          exerciseId: exercise.id,
          exerciseOrder: 3,
          plannedSets: 4,
          plannedReps: 10,
          restSeconds,
        })
        .expect(400);
      for (const path of [templatePath, executionPath])
        await request(app.getHttpServer())
          .patch(path)
          .send({ restSeconds })
          .expect(400);
    }
    for (const path of [templatePath, executionPath]) {
      for (const restSeconds of [0, null, 120]) {
        const result = await request(app.getHttpServer())
          .patch(path)
          .send({ restSeconds })
          .expect(200);
        expect(result.body.restSeconds).toBe(restSeconds);
      }
      const unchanged = await request(app.getHttpServer())
        .patch(path)
        .send({ notes: 'Rest preserved' })
        .expect(200);
      expect(unchanged.body.restSeconds).toBe(120);
    }
    await request(app.getHttpServer())
      .patch(executionPath)
      .send({ restSeconds: 45 })
      .expect(200);
    const template = await request(app.getHttpServer())
      .get(`/workouts/${workout.id}`)
      .expect(200);
    expect(
      template.body.workoutExercises.find((e: Entry) => e.id === first.id)
        .restSeconds,
    ).toBe(120);
    const saved = await request(app.getHttpServer())
      .get(`/workout-sessions/${session.id}`)
      .expect(200);
    expect(saved.body.exerciseSessions[1].restSeconds).toBe(45);
  });

  it('records decimal weights exactly and serializes concurrent set writes', async () => {
    const endpoint = `/workout-sessions/${session.id}/exercises/${session.exerciseSessions[0].id}/sets`;
    const data = {
      setNumber: 1,
      weight: '80.1234567890123456789',
      reps: 10,
      completed: true,
    };
    const created = (
      await request(app.getHttpServer()).put(endpoint).send(data).expect(200)
    ).body as SetResult;
    expect(created.weight).toBe(data.weight);
    const updated = (
      await request(app.getHttpServer())
        .put(endpoint)
        .send({ ...data, reps: 9 })
        .expect(200)
    ).body as SetResult;
    expect(updated.id).toBe(created.id);
    expect(updated.reps).toBe(9);
    await Promise.all(
      [8, 7].map((reps) =>
        request(app.getHttpServer())
          .put(endpoint)
          .send({ ...data, setNumber: 2, reps })
          .expect(200),
      ),
    );
    const saved = (
      await request(app.getHttpServer())
        .get(`/workout-sessions/${session.id}`)
        .expect(200)
    ).body as Session;
    expect(saved.exerciseSessions[0].sets.map((s) => s.setNumber)).toEqual([
      1, 2,
    ]);
    for (const invalid of [
      { weight: -1 },
      { weight: '-1' },
      { weight: '1e3' },
      { weight: null },
      { reps: -1 },
      { setNumber: 0 },
      { completed: null },
    ]) {
      await request(app.getHttpServer())
        .put(endpoint)
        .send({ ...data, ...invalid })
        .expect(400);
    }
    await request(app.getHttpServer())
      .put(`/workout-sessions/${session.id}/exercises/${randomUUID()}/sets`)
      .send(data)
      .expect(404);
  });

  it('keeps completion levels separate and freezes finished sessions', async () => {
    const endpoint = `/workout-sessions/${session.id}`;
    const exercisePath = `${endpoint}/exercises/${session.exerciseSessions[0].id}`;
    await request(app.getHttpServer())
      .patch(exercisePath)
      .send({ completed: true })
      .expect(200);
    const finished = (
      await request(app.getHttpServer())
        .post(`${endpoint}/finish`)
        .send({ notes: 'Done' })
        .expect(200)
    ).body as Session;
    const repeated = (
      await request(app.getHttpServer())
        .post(`${endpoint}/finish`)
        .send({ notes: 'Must not change history' })
        .expect(200)
    ).body as Session;
    expect(repeated).toEqual(finished);
    await request(app.getHttpServer())
      .patch(exercisePath)
      .send({ completed: false })
      .expect(409);
    await request(app.getHttpServer())
      .patch(exercisePath)
      .send({ restSeconds: 60 })
      .expect(409);
    await request(app.getHttpServer())
      .put(`${exercisePath}/sets`)
      .send({ setNumber: 1, weight: '1', reps: 1 })
      .expect(409);
    const saved = (await request(app.getHttpServer()).get(endpoint).expect(200))
      .body as Session;
    expect(saved.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(saved.exerciseSessions.map((e) => e.completed)).toEqual([
      true,
      false,
    ]);
  });

  it('returns user-scoped history, previous performance and exact statistics', async () => {
    const path = `/workout-sessions/exercises/${exercise.id}`;
    const history = (
      await request(app.getHttpServer())
        .get(`/workout-sessions?userId=${user.id}`)
        .expect(200)
    ).body as Session[];
    expect(history.map((s) => s.id)).toEqual([session.id]);
    const performance = (
      await request(app.getHttpServer())
        .get(`${path}/performance?userId=${user.id}`)
        .expect(200)
    ).body as Execution[];
    expect(performance).toHaveLength(2);
    const stats = (
      await request(app.getHttpServer())
        .get(`${path}/statistics?userId=${user.id}`)
        .expect(200)
    ).body as { completedSets: number; maxWeight: string; totalReps: string };
    expect(stats.completedSets).toBe(2);
    expect(stats.maxWeight).toBe('80.1234567890123456789');
    expect(['16', '17']).toContain(stats.totalReps);
    await request(app.getHttpServer())
      .get(`${path}/performance?userId=${otherUser.id}`)
      .expect(200, []);
  });

  it('archives definitions without losing history and blocks empty/archived plans', async () => {
    await request(app.getHttpServer())
      .delete(`/workouts/${workout.id}/exercises/${second.id}`)
      .expect(200);
    const future = (
      await request(app.getHttpServer())
        .post('/workout-sessions/start')
        .send({ userId: user.id, workoutId: workout.id })
        .expect(201)
    ).body as Session;
    expect(future.exerciseSessions).toHaveLength(1);
    expect(future.exerciseSessions[0]).toMatchObject({
      restSeconds: 120,
      plannedSets: 5,
      plannedReps: 6,
    });
    await request(app.getHttpServer())
      .patch(`/exercises/${exercise.id}`)
      .send({ isActive: false, name: `${prefix}-renamed` })
      .expect(200);
    await request(app.getHttpServer())
      .post('/workout-sessions/start')
      .send({ userId: user.id, workoutId: workout.id })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/workouts/${workout.id}`)
      .send({ isActive: false })
      .expect(200);
    await request(app.getHttpServer())
      .post('/workout-sessions/start')
      .send({ userId: user.id, workoutId: workout.id })
      .expect(409);
    await request(app.getHttpServer())
      .get(`/workouts?userId=${user.id}`)
      .expect(200, []);
    const archived = (
      await request(app.getHttpServer())
        .get(`/workouts?userId=${user.id}&includeArchived=true`)
        .expect(200)
    ).body as Row[];
    expect(archived.map((w) => w.id)).toEqual([workout.id]);
    const historic = (
      await request(app.getHttpServer())
        .get(`/workout-sessions/${session.id}`)
        .expect(200)
    ).body as Session;
    expect(historic.exerciseSessions).toHaveLength(2);
    expect(historic.exerciseSessions[0].sets).toHaveLength(2);
  });
});
