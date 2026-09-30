/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { db, type Transaction } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { GeminiWorkoutProvider } from '../src/workouts/generation/gemini-workout.provider.js';
import { WorkoutGenerationService } from '../src/workouts/generation/workout-generation.service.js';

describe('Workout generation with PostgreSQL and a stubbed AI', () => {
  let app: INestApplication<App>;
  const userId = randomUUID();
  const exerciseId = randomUUID();
  const generate = jest.fn<GeminiWorkoutProvider['generate']>();
  const dto = { userId, prompt: 'Treino de peito para iniciante' };
  const plan = {
    name: 'Treino gerado',
    notes: 'Manter técnica',
    exercises: [
      {
        exerciseId,
        plannedSets: 3,
        plannedReps: 10,
        restSeconds: 60,
        notes: '',
      },
      {
        exerciseId,
        plannedSets: 2,
        plannedReps: 12,
        restSeconds: 90,
        notes: '',
      },
    ],
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GeminiWorkoutProvider)
      .useValue({ generate })
      .compile();
    app = module.createNestApplication();
    await app.init();
    await db.orm.public.User.create({ id: userId, name: 'AI test' });
    await db.orm.public.Exercise.create({
      id: exerciseId,
      name: 'Supino teste',
      muscleGroup: 'Peito',
    });
  });
  beforeEach(() => generate.mockReset().mockResolvedValue(plan));
  afterAll(async () => {
    try {
      await db.transaction(async (tx) => {
        const sessions = await tx.orm.public.WorkoutSession.where({
          userId,
        }).all();
        for (const session of sessions) {
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
        await tx.orm.public.Exercise.where({ id: exerciseId }).delete();
        await tx.orm.public.User.where({ id: userId }).delete();
      });
    } finally {
      if (app) await app.close();
      else await db.close();
    }
  });
  const saved = () => db.orm.public.Workout.where({ userId }).all();

  it('validates HTTP input and user existence before contacting AI', async () => {
    for (const input of [
      { ...dto, prompt: '' },
      { ...dto, prompt: '   ' },
      { ...dto, prompt: null },
      { ...dto, prompt: 'x'.repeat(2001) },
      { ...dto, userId: 'bad' },
      { ...dto, model: 'arbitrary' },
    ])
      await request(app.getHttpServer())
        .post('/workouts/generate')
        .send(input)
        .expect(400);
    await request(app.getHttpServer())
      .post('/workouts/generate')
      .send({ ...dto, userId: randomUUID() })
      .expect(404);
    expect(generate).not.toHaveBeenCalled();
  });
  it('persists ordered entries, retrieves them and starts a session with snapshots', async () => {
    const response = await request(app.getHttpServer())
      .post('/workouts/generate')
      .send(dto)
      .expect(201);
    const workout = response.body as {
      id: string;
      workoutExercises: { exerciseOrder: number }[];
    };
    expect(workout.workoutExercises.map((e) => e.exerciseOrder)).toEqual([
      1, 2,
    ]);
    const read = await request(app.getHttpServer())
      .get('/workouts/' + workout.id)
      .expect(200);
    expect(read.body).toEqual(response.body);
    const session = await request(app.getHttpServer())
      .post('/workout-sessions/start')
      .send({ userId, workoutId: workout.id })
      .expect(201);
    expect(session.body.exerciseSessions).toEqual([
      expect.objectContaining({
        plannedSets: 3,
        plannedReps: 10,
        restSeconds: 60,
      }),
      expect.objectContaining({
        plannedSets: 2,
        plannedReps: 12,
        restSeconds: 90,
      }),
    ]);
  });
  it('rejects fabricated IDs, invalid plans and refusals without writing', async () => {
    const before = await saved();
    for (const [output, status] of [
      [
        {
          ...plan,
          exercises: [{ ...plan.exercises[0], exerciseId: randomUUID() }],
        },
        502,
      ],
      [{ ...plan, exercises: [{ ...plan.exercises[0], plannedSets: 0 }] }, 502],
      [{ ...plan, exercises: [] }, 422],
    ] as const) {
      generate.mockResolvedValueOnce(output);
      await request(app.getHttpServer())
        .post('/workouts/generate')
        .send(dto)
        .expect(status);
    }
    expect(await saved()).toEqual(before);
  });
  it('rejects an exercise archived during generation', async () => {
    const before = await saved();
    generate.mockImplementationOnce(async () => {
      await db.orm.public.Exercise.where({ id: exerciseId }).update({
        isActive: false,
      });
      return plan;
    });
    try {
      await request(app.getHttpServer())
        .post('/workouts/generate')
        .send(dto)
        .expect(409);
      expect(await saved()).toEqual(before);
    } finally {
      await db.orm.public.Exercise.where({ id: exerciseId }).update({
        isActive: true,
      });
    }
  });
  it('rolls back the workout and its first entry if the second write fails', async () => {
    const before = await saved();
    let attempts = 0;
    const failure = new Error('Injected second write failure');
    const prisma = {
      db: {
        orm: db.orm,
        transaction: <R>(callback: (tx: Transaction) => PromiseLike<R>) =>
          db.transaction(async (tx) => {
            const collection = tx.orm.public.WorkoutExercise;
            const failingCollection = new Proxy(collection, {
              get(target, key, receiver) {
                if (key === 'create')
                  return async (
                    data: Parameters<typeof collection.create>[0],
                  ) => {
                    if (++attempts === 2) throw failure;
                    return await collection.create(data);
                  };
                return Reflect.get(target, key, receiver) as unknown;
              },
            });
            return await callback({
              ...tx,
              orm: {
                ...tx.orm,
                public: {
                  ...tx.orm.public,
                  User: tx.orm.public.User,
                  Exercise: tx.orm.public.Exercise,
                  Workout: tx.orm.public.Workout,
                  WorkoutExercise: failingCollection,
                  WorkoutSession: tx.orm.public.WorkoutSession,
                  ExerciseSession: tx.orm.public.ExerciseSession,
                  ExerciseSet: tx.orm.public.ExerciseSet,
                },
              },
            });
          }),
      },
    } as unknown as PrismaService;
    const service = new WorkoutGenerationService(prisma, {
      generate,
    });
    await expect(service.generate(dto)).rejects.toThrow(failure);
    expect(attempts).toBe(2);
    expect(await saved()).toEqual(before);
  });
});
