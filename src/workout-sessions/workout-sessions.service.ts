import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { resolveExerciseMuscles } from '../exercises/exercise-muscles.js';
import type { WorkoutShareSummary } from './dto/workout-share-summary.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Transaction } from '../prisma/db.js';
import { WorkoutsService } from '../workouts/workouts.service.js';
import { HistoryQueryDto } from '../common/dto/list-query.dto.js';
import {
  FinishWorkoutSessionDto,
  RecordSetDto,
  StartWorkoutSessionDto,
  UpdateExerciseSessionDto,
} from './dto/workout-session.dto.js';

@Injectable()
export class WorkoutSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workouts: WorkoutsService,
  ) {}

  start(dto: StartWorkoutSessionDto) {
    return this.prisma.db.transaction(async (tx) => {
      const workout = await this.workouts.lock(tx, dto.workoutId);
      if (workout.userId !== dto.userId)
        throw new NotFoundException('Workout not found for this user');
      const entries = await tx.orm.public.WorkoutExercise.where({
        workoutId: workout.id,
        isActive: true,
      })
        .orderBy((e) => e.exerciseOrder.asc())
        .all();
      // Lock shared exercise definitions in stable order, including repetitions
      // only once, so concurrent archiving cannot change the eligible plan.
      const activeExerciseIds = new Set<string>();
      for (const id of [...new Set(entries.map((e) => e.exerciseId))].sort()) {
        const exercise = await tx.orm.public.Exercise.where({ id }).update({
          id,
        });
        if (exercise?.isActive) activeExerciseIds.add(id);
      }
      const plan = entries.filter((e) => activeExerciseIds.has(e.exerciseId));
      if (!plan.length)
        throw new ConflictException('Workout has no active exercises');
      const session = await tx.orm.public.WorkoutSession.create(dto);
      const exerciseSessions: Awaited<
        ReturnType<typeof tx.orm.public.ExerciseSession.create>
      >[] = [];
      for (const entry of plan) {
        exerciseSessions.push(
          await tx.orm.public.ExerciseSession.create({
            workoutSessionId: session.id,
            workoutExerciseId: entry.id,
            exerciseOrder: entry.exerciseOrder,
            plannedSets: entry.plannedSets,
            plannedReps: entry.plannedReps,
            restSeconds: entry.restSeconds,
            notes: entry.notes,
          }),
        );
      }
      return { ...session, exerciseSessions };
    });
  }

  private async lockSession(tx: Transaction, id: string) {
    const session = await tx.orm.public.WorkoutSession.where({ id }).update({
      id,
    });
    if (!session) throw new NotFoundException('Workout session not found');
    return session;
  }

  private async editableExercise(
    tx: Transaction,
    workoutSessionId: string,
    id: string,
  ) {
    const session = await this.lockSession(tx, workoutSessionId);
    if (session.finishedAt)
      throw new ConflictException('Finished sessions cannot be changed');
    const exercise = await tx.orm.public.ExerciseSession.where({
      id,
      workoutSessionId,
    }).first();
    if (!exercise)
      throw new NotFoundException(
        'Exercise session not found in this workout session',
      );
    return exercise;
  }

  recordSet(
    workoutSessionId: string,
    exerciseSessionId: string,
    dto: RecordSetDto,
  ) {
    return this.prisma.db.transaction(async (tx) => {
      await this.editableExercise(tx, workoutSessionId, exerciseSessionId);
      const existing = await tx.orm.public.ExerciseSet.where({
        exerciseSessionId,
        setNumber: dto.setNumber,
      }).first();
      if (existing) {
        const updated = await tx.orm.public.ExerciseSet.where({
          id: existing.id,
        }).update(dto);
        return updated;
      }
      return tx.orm.public.ExerciseSet.create({
        ...dto,
        exerciseSessionId,
        completed: dto.completed ?? false,
      });
    });
  }

  updateExercise(
    workoutSessionId: string,
    id: string,
    dto: UpdateExerciseSessionDto,
  ) {
    return this.prisma.db.transaction(async (tx) => {
      const exercise = await this.editableExercise(tx, workoutSessionId, id);
      if (!Object.keys(dto).length) return exercise;
      const updated = await tx.orm.public.ExerciseSession.where({ id }).update(
        dto,
      );
      return updated;
    });
  }

  finish(id: string, dto: FinishWorkoutSessionDto) {
    return this.prisma.db.transaction(async (tx) => {
      const session = await this.lockSession(tx, id);
      // Idempotency preserves the original finish timestamp and notes.
      if (session.finishedAt) return session;
      const finished = await tx.orm.public.WorkoutSession.where({ id }).update({
        finishedAt: Temporal.Now.instant(),
        ...dto,
      });
      return finished;
    });
  }

  async get(id: string) {
    const session = await this.prisma.db.orm.public.WorkoutSession.include(
      'workout',
    )
      .include('exerciseSessions', (exercises) =>
        exercises
          .orderBy((e) => e.exerciseOrder.asc())
          .include('workoutExercise', (entry) => entry.include('exercise'))
          .include('sets', (sets) => sets.orderBy((s) => s.setNumber.asc())),
      )
      .first({ id });
    if (!session) throw new NotFoundException('Workout session not found');
    return {
      ...session,
      durationSeconds: session.finishedAt
        ? Math.floor(
            (session.finishedAt.epochMilliseconds -
              session.startedAt.epochMilliseconds) /
              1000,
          )
        : null,
    };
  }

  async shareSummary(id: string): Promise<WorkoutShareSummary> {
    // This resource lookup deliberately returns 404 for malformed IDs too.
    if (!isUUID(id)) throw new NotFoundException('Workout session not found');
    const session = await this.get(id);
    if (!session.finishedAt)
      throw new BadRequestException('Workout session is not finished');
    if (!session.workout) throw new NotFoundException('Workout not found');

    const performedExercises = session.exerciseSessions
      .filter(
        (execution) =>
          execution.completed || execution.sets.some((set) => set.completed),
      )
      .flatMap((execution) => {
        const exercise = execution.workoutExercise?.exercise;
        return exercise ? [exercise] : [];
      });
    const exerciseIds = [...new Set(performedExercises.map((e) => e.id))];
    const mappings = exerciseIds.length
      ? await this.prisma.db.orm.public.ExerciseMuscle.where((mapping) =>
          mapping.exerciseId.in(exerciseIds),
        )
          .include('muscleGroup')
          .all()
      : [];
    const mappedMuscles = new Map<string, string[]>();
    for (const mapping of mappings) {
      if (!mapping.muscleGroup) continue;
      const slugs = mappedMuscles.get(mapping.exerciseId) ?? [];
      slugs.push(mapping.muscleGroup.slug);
      mappedMuscles.set(mapping.exerciseId, slugs);
    }

    return {
      workoutSessionId: session.id,
      workoutName: session.workout.name,
      durationSeconds: Math.floor(
        (session.finishedAt.epochMilliseconds -
          session.startedAt.epochMilliseconds) /
          1000,
      ),
      muscles: [
        ...new Set(
          performedExercises.flatMap((exercise) =>
            resolveExerciseMuscles(
              exercise,
              mappedMuscles.get(exercise.id) ?? [],
            ),
          ),
        ),
      ].sort(),
    };
  }

  async list(query: HistoryQueryDto) {
    await this.requireUser(query.userId);
    let sessions = this.prisma.db.orm.public.WorkoutSession.where({
      userId: query.userId,
    });
    if (query.workoutId)
      sessions = sessions.where({ workoutId: query.workoutId });
    return await sessions
      .orderBy((s) => s.startedAt.desc())
      .orderBy((s) => s.id.asc())
      .limit(query.limit)
      .offset(query.offset)
      .all();
  }

  private async requireUser(id: string) {
    if (!(await this.prisma.db.orm.public.User.first({ id })))
      throw new NotFoundException('User not found');
  }

  async performance(exerciseId: string, query: HistoryQueryDto) {
    await this.requireUser(query.userId);
    if (!(await this.prisma.db.orm.public.Exercise.first({ id: exerciseId })))
      throw new NotFoundException('Exercise not found');
    let sessions = this.prisma.db.orm.public.ExerciseSession.where((e) =>
      e.workoutExercise.some({ exerciseId }),
    )
      .where((e) => e.workoutSession.some({ userId: query.userId }))
      .where((e) => e.workoutSession.some((s) => s.finishedAt.isNotNull()));
    if (query.workoutId)
      sessions = sessions.where((e) =>
        e.workoutSession.some({ workoutId: query.workoutId }),
      );
    return await sessions
      .include('workoutSession')
      .include('sets', (sets) => sets.orderBy((s) => s.setNumber.asc()))
      .orderBy((e) => e.createdAt.desc())
      .orderBy((e) => e.id.asc())
      .limit(query.limit)
      .offset(query.offset)
      .all();
  }

  async statistics(exerciseId: string, query: HistoryQueryDto) {
    await this.requireUser(query.userId);
    if (!(await this.prisma.db.orm.public.Exercise.first({ id: exerciseId })))
      throw new NotFoundException('Exercise not found');
    let sets = this.prisma.db.orm.public.ExerciseSet.where({ completed: true })
      .where((set) =>
        set.exerciseSession.some((e) => e.workoutExercise.some({ exerciseId })),
      )
      .where((set) =>
        set.exerciseSession.some((e) =>
          e.workoutSession.some({ userId: query.userId }),
        ),
      )
      .where((set) =>
        set.exerciseSession.some((e) =>
          e.workoutSession.some((s) => s.finishedAt.isNotNull()),
        ),
      );
    if (query.workoutId)
      sets = sets.where((set) =>
        set.exerciseSession.some((e) =>
          e.workoutSession.some({ workoutId: query.workoutId }),
        ),
      );
    const stats = await sets.aggregate((a) => ({
      completedSets: a.count(),
      totalReps: a.sumBigInt('reps'),
      maxWeight: a.max('weight'),
    }));
    return { ...stats, totalReps: String(stats.totalReps ?? 0n) };
  }
}
