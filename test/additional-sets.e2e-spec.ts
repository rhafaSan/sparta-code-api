import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { db } from '../src/prisma/db.js';
import {
  clearFixtureAuth,
  createFixtureUser,
  fixtureAccessToken,
} from './auth-helpers.js';

interface Execution {
  id: string;
  plannedSets: number;
  sets: {
    id: string;
    setNumber: number;
    setType: string;
    weight: string | null;
    reps: number | null;
    completed: boolean;
  }[];
}
interface Session {
  id: string;
  exerciseSessions: Execution[];
}

describe('Additional sets with PostgreSQL', () => {
  let app: INestApplication<App>;
  let token: string;
  let session: Session;
  const userId = randomUUID();
  const workoutId = randomUUID();
  const exerciseIds = [randomUUID(), randomUUID()];
  const entryIds = [randomUUID(), randomUUID()];
  const start = (additionalSets: unknown) =>
    request(app.getHttpServer())
      .post('/workout-sessions/start')
      .auth(token, { type: 'bearer' })
      .send({ userId, workoutId, additionalSets });
  const path = (index = 0) =>
    `/workout-sessions/${session.id}/exercises/${session.exerciseSessions[index].id}`;
  const put = (data: object, index = 0) =>
    request(app.getHttpServer())
      .put(`${path(index)}/sets`)
      .auth(token, { type: 'bearer' })
      .send(data);
  const remove = (setNumber: number) =>
    request(app.getHttpServer())
      .delete(`${path()}/sets/${setNumber}`)
      .auth(token, { type: 'bearer' });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    await createFixtureUser(userId, 'Additional sets test');
    token = await fixtureAccessToken(app, userId);
    await db.orm.public.Workout.create({
      id: workoutId,
      userId,
      name: 'Additional sets test',
    });
    for (const [index, id] of exerciseIds.entries()) {
      await db.orm.public.Exercise.create({
        id,
        name: `Additional sets ${index}`,
        muscleGroup: index ? 'Panturrilha' : 'Peito',
      });
      await db.orm.public.WorkoutExercise.create({
        id: entryIds[index],
        workoutId,
        exerciseId: id,
        exerciseOrder: index + 1,
        plannedSets: 3,
        plannedReps: 10,
      });
    }
  });

  afterAll(async () => {
    try {
      await db.transaction(async (tx) => {
        await tx.orm.public.ExerciseSet.where((set) =>
          set.exerciseSession.some((execution) =>
            execution.workoutSession.some({ userId }),
          ),
        ).deleteAll();
        await tx.orm.public.ExerciseSession.where((execution) =>
          execution.workoutSession.some({ userId }),
        ).deleteAll();
        await tx.orm.public.WorkoutSession.where({ userId }).deleteAll();
        await tx.orm.public.WorkoutExercise.where({ workoutId }).deleteAll();
        await tx.orm.public.Workout.where({ id: workoutId }).delete();
        for (const id of exerciseIds)
          await tx.orm.public.Exercise.where({ id }).delete();
        await clearFixtureAuth(tx, userId);
        await tx.orm.public.User.where({ id: userId }).delete();
      });
    } finally {
      await app.close();
    }
  });

  it('rejects invalid selections without creating partial sessions', async () => {
    const selection = {
      workoutExerciseId: entryIds[0],
      sets: [{ setNumber: 1, setType: 'warmup' }],
    };
    for (const input of [
      null,
      {},
      [null],
      [selection, selection],
      [{ ...selection, workoutExerciseId: randomUUID() }],
      [{ ...selection, sets: [selection.sets[0], selection.sets[0]] }],
      [{ ...selection, sets: [{ setNumber: 0, setType: 'warmup' }] }],
      [{ ...selection, sets: [{ setNumber: 1, setType: 'working' }] }],
      [{ ...selection, sets: [null] }],
    ])
      await start(input).expect(400);
    expect(
      await db.orm.public.WorkoutSession.where({ userId }).all(),
    ).toHaveLength(0);
  });

  it('creates additional sets only for selected exercises without changing snapshots', async () => {
    const response = await start([
      {
        workoutExerciseId: entryIds[0],
        sets: [
          { setNumber: 1, setType: 'warmup' },
          { setNumber: 2, setType: 'preparatory' },
        ],
      },
    ]).expect(201);
    session = response.body as Session;
    expect(session.exerciseSessions[0].plannedSets).toBe(3);
    expect(session.exerciseSessions[0].sets).toEqual([
      expect.objectContaining({
        setNumber: 1,
        setType: 'warmup',
        weight: null,
        reps: null,
        completed: false,
      }),
      expect.objectContaining({
        setNumber: 2,
        setType: 'preparatory',
        completed: false,
      }),
    ]);
    expect(session.exerciseSessions[1].sets).toEqual([]);
    expect(
      (await db.orm.public.WorkoutExercise.first({ id: entryIds[0] }))
        ?.plannedSets,
    ).toBe(3);
  });

  it('edits types, adds and removes additional sets, and preserves omitted values', async () => {
    await put({
      setNumber: 1,
      weight: '100.123456789',
      reps: 30,
      completed: true,
    }).expect(200);
    const updated = await put({ setNumber: 1, reps: 25 }).expect(200);
    expect(updated.body as unknown).toMatchObject({
      setType: 'warmup',
      weight: '100.123456789',
      reps: 25,
      completed: true,
    });
    await put({ setNumber: 2, setType: 'warmup' }).expect(200);
    await put({
      setNumber: 2,
      setType: 'preparatory',
      weight: '90',
      reps: 20,
      completed: true,
    }).expect(200);
    const working = await put({
      setNumber: 3,
      weight: '50.25',
      reps: 10,
      completed: true,
    }).expect(200);
    expect(working.body as unknown).toMatchObject({ setType: 'working' });
    await put({ setNumber: 4, setType: 'warmup' }).expect(200);
    await remove(4).expect(200);
    await remove(4).expect(404);
    await remove(1).expect(409);
    await remove(3).expect(409);
    for (const setType of [null, '', 'invalid', 1])
      await put({ setNumber: 5, setType }).expect(400);
    // A completed execution with only warmups must not add its muscle to the summary.
    await put(
      {
        setNumber: 1,
        setType: 'warmup',
        weight: '200',
        reps: 100,
        completed: true,
      },
      1,
    ).expect(200);
    await request(app.getHttpServer())
      .patch(path(1))
      .auth(token, { type: 'bearer' })
      .send({ completed: true })
      .expect(200);
  });

  it('keeps all sets in history but excludes additional sets from every summary', async () => {
    await request(app.getHttpServer())
      .post(`/workout-sessions/${session.id}/finish`)
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(200);
    const history = await request(app.getHttpServer())
      .get(`/workout-sessions/${session.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(
      (history.body as Session).exerciseSessions[0].sets.map(
        (set) => set.setType,
      ),
    ).toEqual(['warmup', 'preparatory', 'working']);
    const previous = await request(app.getHttpServer())
      .get(`/workout-sessions/exercises/${exerciseIds[0]}/performance`)
      .query({ userId })
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect((previous.body as Execution[])[0].sets).toHaveLength(3);
    const stats = await request(app.getHttpServer())
      .get(`/workout-sessions/exercises/${exerciseIds[0]}/statistics`)
      .query({ userId })
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(stats.body as unknown).toEqual({
      completedSets: 1,
      totalReps: '10',
      maxWeight: '50.25',
    });
    const today = Temporal.Now.plainDateISO('UTC').toString();
    const report = await request(app.getHttpServer())
      .get('/workout-sessions/progress-report')
      .query({
        startDate: today,
        endDate: today,
        timeZone: 'UTC',
        groupBy: 'week',
      })
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(report.body as unknown).toMatchObject({
      totals: { completedSets: 1, totalReps: '10', maxWeight: '50.25' },
    });
    const summary = await request(app.getHttpServer())
      .get(`/workout-sessions/${session.id}/share-summary`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(summary.body as unknown).toMatchObject({ muscles: ['chest'] });
    await put({ setNumber: 4, setType: 'warmup' }).expect(409);
    await remove(2).expect(409);
  });
});
