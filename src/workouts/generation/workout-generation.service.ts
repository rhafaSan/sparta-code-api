import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GenerateWorkoutDto } from '../dto/generate-workout.dto.js';
import { GeminiWorkoutProvider } from './gemini-workout.provider.js';
import { validateGeneratedWorkout } from './generated-workout.js';

@Injectable()
export class WorkoutGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: GeminiWorkoutProvider,
  ) {}

  async generate(dto: GenerateWorkoutDto) {
    const db = this.prisma.db;
    if (!(await db.orm.public.User.first({ id: dto.userId })))
      throw new NotFoundException('User not found');
    const catalog = await db.orm.public.Exercise.where({ isActive: true })
      .select('id', 'name', 'muscleGroup')
      .orderBy((e) => e.id.asc())
      .limit(501)
      .all();
    if (!catalog.length)
      throw new ConflictException(
        'Create or seed active exercises before generating a workout',
      );
    if (catalog.length > 500)
      throw new ConflictException(
        'AI generation supports up to 500 active catalog exercises',
      );

    // The network request runs before the transaction so no database locks are held.
    const generated = await this.provider.generate(dto.prompt.trim(), catalog);
    if (
      generated &&
      typeof generated === 'object' &&
      'exercises' in generated &&
      Array.isArray(generated.exercises) &&
      generated.exercises.length === 0
    )
      throw new UnprocessableEntityException(
        'The prompt could not be fulfilled with the available exercises',
      );
    const plan = validateGeneratedWorkout(generated);
    const allowed = new Set(catalog.map((e) => e.id));
    if (plan.exercises.some((e) => !allowed.has(e.exerciseId)))
      throw new BadGatewayException(
        'AI selected an exercise outside the supplied catalog',
      );

    return db.transaction(async (tx) => {
      // Recheck and lock definitions after generation, in a stable lock order.
      for (const id of [
        ...new Set(plan.exercises.map((e) => e.exerciseId)),
      ].sort()) {
        const exercise = await tx.orm.public.Exercise.where({ id }).update({
          id,
        });
        if (!exercise?.isActive)
          throw new ConflictException(
            'The exercise catalog changed; generate again',
          );
      }
      if (!(await tx.orm.public.User.first({ id: dto.userId })))
        throw new NotFoundException('User not found');
      const workout = await tx.orm.public.Workout.create({
        userId: dto.userId,
        name: plan.name.trim(),
        notes: plan.notes,
      });
      for (const [index, exercise] of plan.exercises.entries())
        await tx.orm.public.WorkoutExercise.create({
          workoutId: workout.id,
          exerciseId: exercise.exerciseId,
          exerciseOrder: index + 1,
          plannedSets: exercise.plannedSets,
          plannedReps: exercise.plannedReps,
          restSeconds: exercise.restSeconds,
          notes: exercise.notes,
        });
      return await tx.orm.public.Workout.include(
        'workoutExercises',
        (entries) =>
          entries.orderBy((e) => e.exerciseOrder.asc()).include('exercise'),
      ).first({ id: workout.id });
    });
  }
}
