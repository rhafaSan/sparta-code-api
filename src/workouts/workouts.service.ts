import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Transaction } from '../prisma/db.js';
import { WorkoutQueryDto } from '../common/dto/list-query.dto.js';
import {
  AddWorkoutExerciseDto,
  CreateWorkoutDto,
  ReorderWorkoutExercisesDto,
  UpdateWorkoutDto,
  UpdateWorkoutExerciseDto,
} from './dto/workout.dto.js';

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  // A no-op update locks the parent row until commit. Every template write and
  // session start takes this same lock, keeping the plan snapshot consistent.
  async lock(tx: Transaction, id: string, requireActive = true) {
    const workout = await tx.orm.public.Workout.where({ id }).update({ id });
    if (!workout) throw new NotFoundException('Workout not found');
    if (requireActive && !workout.isActive)
      throw new ConflictException('Workout is archived');
    return workout;
  }

  async create(dto: CreateWorkoutDto) {
    if (!(await this.prisma.db.orm.public.User.first({ id: dto.userId })))
      throw new NotFoundException('User not found');
    return this.prisma.db.orm.public.Workout.create({
      ...dto,
      name: dto.name.trim(),
    });
  }

  async list(query: WorkoutQueryDto) {
    if (!(await this.prisma.db.orm.public.User.first({ id: query.userId })))
      throw new NotFoundException('User not found');
    let workouts = this.prisma.db.orm.public.Workout.where({
      userId: query.userId,
    });
    if (!query.includeArchived) workouts = workouts.where({ isActive: true });
    return await workouts
      .orderBy((w) => w.createdAt.desc())
      .orderBy((w) => w.id.asc())
      .limit(query.limit)
      .offset(query.offset)
      .all();
  }

  async get(id: string) {
    const workout = await this.prisma.db.orm.public.Workout.include(
      'workoutExercises',
      (entries) =>
        entries
          .where({ isActive: true })
          .orderBy((e) => e.exerciseOrder.asc())
          .include('exercise'),
    ).first({ id });
    if (!workout) throw new NotFoundException('Workout not found');
    return workout;
  }

  update(id: string, dto: UpdateWorkoutDto) {
    return this.prisma.db.transaction(async (tx) => {
      const workout = await this.lock(tx, id, false);
      if (!Object.keys(dto).length) return workout;
      const updated = await tx.orm.public.Workout.where({ id }).update({
        ...dto,
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      });
      return updated;
    });
  }

  addExercise(workoutId: string, dto: AddWorkoutExerciseDto) {
    return this.prisma.db.transaction(async (tx) => {
      await this.lock(tx, workoutId);
      const exercise = await tx.orm.public.Exercise.where({
        id: dto.exerciseId,
      }).update({ id: dto.exerciseId });
      if (!exercise) throw new NotFoundException('Exercise not found');
      if (!exercise.isActive)
        throw new ConflictException('Exercise is archived');
      if (
        await tx.orm.public.WorkoutExercise.where({
          workoutId,
          exerciseOrder: dto.exerciseOrder,
        }).first()
      )
        throw new ConflictException(
          'Exercise order is already occupied, including archived entries',
        );
      return tx.orm.public.WorkoutExercise.create({ ...dto, workoutId });
    });
  }

  updateExercise(workoutId: string, id: string, dto: UpdateWorkoutExerciseDto) {
    return this.prisma.db.transaction(async (tx) => {
      await this.lock(tx, workoutId);
      const entry = await tx.orm.public.WorkoutExercise.where({
        id,
        workoutId,
      }).first();
      if (!entry) throw new NotFoundException('Workout exercise not found');
      if (dto.isActive === true) {
        const exercise = await tx.orm.public.Exercise.where({
          id: entry.exerciseId,
        }).update({ id: entry.exerciseId });
        if (!exercise?.isActive)
          throw new ConflictException('Exercise is archived');
      }
      if (
        dto.exerciseOrder !== undefined &&
        dto.exerciseOrder !== entry.exerciseOrder
      ) {
        const occupied = await tx.orm.public.WorkoutExercise.where({
          workoutId,
          exerciseOrder: dto.exerciseOrder,
        }).first();
        if (occupied)
          throw new ConflictException(
            'Exercise order is already occupied; use the reorder endpoint to swap positions',
          );
      }
      if (!Object.keys(dto).length) return entry;
      const updated = await tx.orm.public.WorkoutExercise.where({ id }).update(
        dto,
      );
      return updated;
    });
  }

  archiveExercise(workoutId: string, id: string) {
    return this.updateExercise(workoutId, id, { isActive: false });
  }

  reorder(workoutId: string, dto: ReorderWorkoutExercisesDto) {
    return this.prisma.db.transaction(async (tx) => {
      await this.lock(tx, workoutId);
      const entries = await tx.orm.public.WorkoutExercise.where({ workoutId })
        .orderBy((e) => e.exerciseOrder.asc())
        .all();
      const active = entries.filter((entry) => entry.isActive);
      const ids = new Set(dto.workoutExerciseIds);
      if (
        ids.size !== active.length ||
        active.some((entry) => !ids.has(entry.id))
      )
        throw new ConflictException(
          'Provide every active workoutExerciseId exactly once',
        );
      const order = [
        ...dto.workoutExerciseIds,
        ...entries.filter((entry) => !entry.isActive).map((entry) => entry.id),
      ];
      // Vacate positive positions before assigning the new order. Temporary
      // negatives are private to this transaction and preserve the unique key.
      for (const [index, id] of order.entries())
        await tx.orm.public.WorkoutExercise.where({ id }).update({
          exerciseOrder: -(index + 1),
        });
      for (const [index, id] of order.entries())
        await tx.orm.public.WorkoutExercise.where({ id }).update({
          exerciseOrder: index + 1,
        });
      return await tx.orm.public.WorkoutExercise.where({
        workoutId,
        isActive: true,
      })
        .orderBy((e) => e.exerciseOrder.asc())
        .all();
    });
  }
}
