import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { db, type Transaction } from '../src/prisma/db.js';
import { seedMuscles } from '../src/prisma/seed-muscles.js';

describe('Muscle share summary with PostgreSQL', () => {
  let app: INestApplication<App>;
  const userId = randomUUID();
  const workoutId = randomUUID();
  const sessionId = randomUUID();
  const exerciseIds = [randomUUID(), randomUUID(), randomUUID()];
  const executionIds = [randomUUID(), randomUUID(), randomUUID()];
  const startedAt = Temporal.Instant.from('2026-09-11T18:30:00Z');
  const finishedAt = Temporal.Instant.from('2026-09-11T19:38:00Z');
  const url = `/workout-sessions/${sessionId}/share-summary`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    await db.transaction(async (tx) => {
      await tx.orm.public.User.create({ id: userId, name: 'Summary test' });
      await tx.orm.public.Workout.create({
        id: workoutId,
        userId,
        name: 'Costas e bíceps',
        isActive: false,
      });
      await tx.orm.public.WorkoutSession.create({
        id: sessionId,
        userId,
        workoutId,
        startedAt,
      });
      for (const [index, id] of exerciseIds.entries()) {
        await tx.orm.public.Exercise.create({
          id,
          name: `Summary exercise ${index}`,
          isActive: false,
          muscleGroup: 'Legado preservado',
        });
        const entry = await tx.orm.public.WorkoutExercise.create({
          workoutId,
          exerciseId: id,
          exerciseOrder: index + 1,
          plannedSets: 3,
          plannedReps: 10,
          isActive: false,
        });
        await tx.orm.public.ExerciseSession.create({
          id: executionIds[index],
          workoutSessionId: sessionId,
          workoutExerciseId: entry.id,
          exerciseOrder: index + 1,
          plannedSets: 3,
          plannedReps: 10,
          completed: index === 2,
        });
        await tx.orm.public.ExerciseSet.create({
          exerciseSessionId: executionIds[index],
          setNumber: 1,
          completed: index !== 2,
        });
      }
    });
    await seedMuscles(db, [
      { exerciseId: exerciseIds[0], muscleSlug: 'lats', role: 'primary' },
      { exerciseId: exerciseIds[0], muscleSlug: 'biceps', role: 'secondary' },
      { exerciseId: exerciseIds[1], muscleSlug: 'biceps', role: 'primary' },
      { exerciseId: exerciseIds[1], muscleSlug: 'forearms', role: 'secondary' },
      { exerciseId: exerciseIds[2], muscleSlug: 'chest', role: 'primary' },
    ]);
  });

  afterAll(async () => {
    try {
      await db.transaction(async (tx) => {
        for (const id of executionIds)
          await tx.orm.public.ExerciseSet.where({
            exerciseSessionId: id,
          }).deleteAll();
        await tx.orm.public.ExerciseSession.where({
          workoutSessionId: sessionId,
        }).deleteAll();
        await tx.orm.public.WorkoutSession.where({ id: sessionId }).delete();
        await tx.orm.public.WorkoutExercise.where({ workoutId }).deleteAll();
        await tx.orm.public.Workout.where({ id: workoutId }).delete();
        await tx.orm.public.User.where({ id: userId }).delete();
        for (const id of exerciseIds) {
          await tx.orm.public.ExerciseMuscle.where({
            exerciseId: id,
          }).deleteAll();
          await tx.orm.public.Exercise.where({ id }).delete();
        }
      });
    } finally {
      if (app) await app.close();
      else await db.close();
    }
  });

  it('returns 404 for malformed and missing session IDs', async () => {
    await request(app.getHttpServer())
      .get('/workout-sessions/invalid/share-summary')
      .expect(404);
    await request(app.getHttpServer())
      .get(`/workout-sessions/${randomUUID()}/share-summary`)
      .expect(404);
  });

  it('returns 400 for an open session', async () => {
    await request(app.getHttpServer()).get(url).expect(400);
  });

  it('returns exact duration and sorted unique primary/secondary muscles only from performed exercises, even archived ones', async () => {
    await db.orm.public.WorkoutSession.where({ id: sessionId }).update({
      finishedAt,
    });
    const before = await db.orm.public.ExerciseSession.where({
      workoutSessionId: sessionId,
    }).all();
    const response = await request(app.getHttpServer()).get(url).expect(200);
    expect(response.body).toEqual({
      workoutSessionId: sessionId,
      workoutName: 'Costas e bíceps',
      durationSeconds: 4080,
      muscles: ['biceps', 'forearms', 'lats'],
    });
    expect(
      await db.orm.public.ExerciseSession.where({
        workoutSessionId: sessionId,
      }).all(),
    ).toEqual(before);
  });

  it('returns an empty array when performed exercises have no mappings', async () => {
    for (const exerciseId of exerciseIds.slice(0, 2))
      await db.orm.public.ExerciseMuscle.where({ exerciseId }).deleteAll();
    const response = await request(app.getHttpServer()).get(url).expect(200);
    expect(response.body).toMatchObject({ muscles: [] });
  });

  it('ignores completed exercise flags when there are no completed sets', async () => {
    for (const id of executionIds)
      await db.orm.public.ExerciseSet.where({
        exerciseSessionId: id,
      }).deleteAll();
    const response = await request(app.getHttpServer()).get(url).expect(200);
    expect(response.body).toMatchObject({ muscles: [] });
  });

  it('seeds idempotently, preserves edits, and validates roles/views before writing', async () => {
    const rollback = new Error('Rollback seed test');
    await expect(
      db.transaction(async (tx) => {
        const database = {
          transaction: async <R>(
            callback: (transaction: Transaction) => PromiseLike<R>,
          ): Promise<R> => await callback(tx),
        };
        const mappings = [
          {
            exerciseId: exerciseIds[0],
            muscleSlug: 'biceps',
            role: 'secondary' as const,
          },
        ];
        await seedMuscles(database, mappings);
        const muscle = await tx.orm.public.MuscleGroup.first({
          slug: 'biceps',
        });
        await tx.orm.public.MuscleGroup.where({ id: muscle!.id }).update({
          name: 'Edited',
          isActive: false,
        });
        await seedMuscles(database, mappings);
        expect(
          await tx.orm.public.ExerciseMuscle.where({
            exerciseId: exerciseIds[0],
          }).all(),
        ).toHaveLength(1);
        expect(
          await tx.orm.public.MuscleGroup.first({ slug: 'biceps' }),
        ).toMatchObject({ name: 'Edited', isActive: false });
        await expect(
          seedMuscles(database, [
            { ...mappings[0], role: 'tertiary' as 'primary' },
          ]),
        ).rejects.toThrow('Invalid exercise muscle mapping');
        await expect(
          seedMuscles(
            database,
            [],
            [{ slug: 'invalid', name: 'Invalid', view: 'side' as 'front' }],
          ),
        ).rejects.toThrow('Invalid muscle group');
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });
});
