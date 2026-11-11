import {
  clearFixtureAuth,
  createFixtureUser,
  fixtureAccessToken,
} from './auth-helpers.js';
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
  let accessToken: string;
  const userId = randomUUID();
  const exerciseId = randomUUID();
  const generate = jest.fn<GeminiWorkoutProvider['generate']>();
  const importSheet = jest.fn<GeminiWorkoutProvider['importSheet']>();
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
      .useValue({ generate, importSheet })
      .compile();
    app = module.createNestApplication();
    await app.init();
    await createFixtureUser(userId, 'AI test');
    accessToken = await fixtureAccessToken(app, userId);
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
        await clearFixtureAuth(tx, userId);
        await tx.orm.public.User.where({ id: userId }).delete();
      });
    } finally {
      if (app) await app.close();
      else await db.close();
    }
  });
  const saved = () => db.orm.public.Workout.where({ userId }).all();

  it('imports multiple workouts for the authenticated user from JSON, TXT and PDF', async () => {
    importSheet.mockResolvedValue({
      workouts: [plan, { ...plan, name: 'Treino B' }],
    });
    for (const kind of ['text', 'txt', 'pdf']) {
      const req = request(app.getHttpServer())
        .post('/workouts/import')
        .set('Authorization', `Bearer ${accessToken}`);
      const result =
        kind === 'text'
          ? await req
              .send({ text: 'Treino A: Supino 3x10\nTreino B: Supino 2x12' })
              .expect(201)
          : await req
              .attach(
                'file',
                Buffer.from(kind === 'pdf' ? '%PDF-1.7' : 'Supino 3x10'),
                {
                  filename: `ficha.${kind}`,
                  contentType:
                    kind === 'pdf' ? 'application/pdf' : 'text/plain',
                },
              )
              .expect(201);
      expect(result.body.workouts).toHaveLength(2);
      expect(result.body.workouts[0].userId).toBe(userId);
      expect(result.body.workouts[0].workoutExercises).toHaveLength(2);
    }
  });

  it('rejects invalid imports before writing any workout', async () => {
    const before = await saved();
    for (const output of [
      { workouts: [] },
      { workouts: [plan, { ...plan, name: '' }] },
      {
        workouts: [
          {
            ...plan,
            exercises: [{ ...plan.exercises[0], exerciseId: randomUUID() }],
          },
        ],
      },
    ]) {
      importSheet.mockResolvedValueOnce(output);
      const result = await request(app.getHttpServer())
        .post('/workouts/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ text: 'Ficha' });
      expect([422, 502]).toContain(result.status);
      expect(await saved()).toEqual(before);
    }
    importSheet.mockClear();
    await request(app.getHttpServer())
      .post('/workouts/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: ' ' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/workouts/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('invalid'), {
        filename: 'ficha.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect(importSheet).not.toHaveBeenCalled();
  });

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
        .set('Authorization', `Bearer ${accessToken}`)
        .send(input)
        .expect(400);
    await request(app.getHttpServer())
      .post('/workouts/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...dto, userId: randomUUID() })
      .expect(403);
    expect(generate).not.toHaveBeenCalled();
  });
  it('persists ordered entries, retrieves them and starts a session with snapshots', async () => {
    const response = await request(app.getHttpServer())
      .post('/workouts/generate')
      .set('Authorization', `Bearer ${accessToken}`)
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
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(read.body).toEqual(response.body);
    const session = await request(app.getHttpServer())
      .post('/workout-sessions/start')
      .set('Authorization', `Bearer ${accessToken}`)
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
        .set('Authorization', `Bearer ${accessToken}`)
        .send(dto)
        .expect(status);
    }
    expect(await saved()).toEqual(before);
  });
  it('creates a workout through HTTP and the real provider adapter with simulated Gemini transport', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'integration-test-key';
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: JSON.stringify(plan) }] },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    generate.mockImplementationOnce((prompt, catalog) =>
      new GeminiWorkoutProvider().generate(prompt, catalog),
    );
    try {
      const response = await request(app.getHttpServer())
        .post('/workouts/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(dto)
        .expect(201);
      expect(response.body.workoutExercises).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(
        fetchMock.mock.calls[0][1]?.body as string,
      ) as { contents: { parts: { text: string }[] }[] };
      expect(
        JSON.parse(payload.contents[0].parts[0].text) as unknown,
      ).toMatchObject({
        prompt: dto.prompt,
        catalog: expect.arrayContaining([
          expect.objectContaining({ id: exerciseId }),
        ]) as unknown,
      });
    } finally {
      fetchMock.mockRestore();
      if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalKey;
    }
  });
  it('returns 503 and saves nothing when the real provider has no API key', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    generate.mockImplementationOnce((prompt, catalog) =>
      new GeminiWorkoutProvider().generate(prompt, catalog),
    );
    const before = await saved();
    try {
      await request(app.getHttpServer())
        .post('/workouts/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(dto)
        .expect(503);
      expect(await saved()).toEqual(before);
    } finally {
      if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey;
    }
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
        .set('Authorization', `Bearer ${accessToken}`)
        .send(dto)
        .expect(409);
      expect(await saved()).toEqual(before);
    } finally {
      await db.orm.public.Exercise.where({ id: exerciseId }).update({
        isActive: true,
      });
    }
  });
  it.each(['generation', 'import'])(
    'rolls back every workout when a write fails during %s',
    async (mode) => {
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
                      if (++attempts === (mode === 'import' ? 3 : 2))
                        throw failure;
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
        importSheet,
      });
      importSheet.mockResolvedValueOnce({ workouts: [plan, plan] });
      await expect(
        mode === 'import'
          ? service.importSheet(userId, 'Ficha')
          : service.generate(dto),
      ).rejects.toThrow(failure);
      expect(attempts).toBe(mode === 'import' ? 3 : 2);
      expect(await saved()).toEqual(before);
    },
  );
});
