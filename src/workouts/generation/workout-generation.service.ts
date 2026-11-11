import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GenerateWorkoutDto } from '../dto/generate-workout.dto.js';
import {
  GeminiWorkoutProvider,
  type CatalogExercise,
} from './gemini-workout.provider.js';
import { validateGeneratedWorkout } from './generated-workout.js';

@Injectable()
export class WorkoutGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GeminiWorkoutProvider)
    private readonly provider: Pick<
      GeminiWorkoutProvider,
      'generate' | 'importSheet'
    >,
  ) {}

  async generate(dto: GenerateWorkoutDto) {
    const workouts = await this.generatePlans(dto.userId, async (catalog) => [
      await this.provider.generate(dto.prompt.trim(), catalog),
    ]);
    return workouts[0];
  }

  async importSheet(userId: string, source: string | Buffer) {
    return {
      workouts: await this.generatePlans(userId, async (catalog) => {
        const result = await this.provider.importSheet(source, catalog);
        if (
          !result ||
          typeof result !== 'object' ||
          Array.isArray(result) ||
          Object.keys(result).some((key) => key !== 'workouts') ||
          !('workouts' in result) ||
          !Array.isArray(result.workouts) ||
          result.workouts.length > 12
        )
          throw new BadGatewayException('AI returned an invalid workout sheet');
        if (!result.workouts.length)
          throw new UnprocessableEntityException(
            'Could not recognize the complete sheet with the available catalog; check exercises, sets and repetitions',
          );
        return result.workouts as unknown[];
      }),
    };
  }

  private async generatePlans(
    userId: string,
    generate: (catalog: CatalogExercise[]) => Promise<unknown[]>,
  ) {
    const db = this.prisma.db;
    if (!(await db.orm.public.User.first({ id: userId })))
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
    const generated = await generate(catalog);
    if (
      generated.some(
        (plan) =>
          plan &&
          typeof plan === 'object' &&
          'exercises' in plan &&
          Array.isArray(plan.exercises) &&
          !plan.exercises.length,
      )
    )
      throw new UnprocessableEntityException(
        'The prompt could not be fulfilled with the available exercises',
      );
    const plans = generated.map(validateGeneratedWorkout);
    const allowed = new Set(catalog.map((e) => e.id));
    if (
      plans
        .flatMap((plan) => plan.exercises)
        .some((e) => !allowed.has(e.exerciseId))
    )
      throw new BadGatewayException(
        'AI selected an exercise outside the supplied catalog',
      );

    return db.transaction(async (tx) => {
      // Recheck and lock definitions after generation, in a stable lock order.
      for (const id of [
        ...new Set(
          plans.flatMap((plan) => plan.exercises).map((e) => e.exerciseId),
        ),
      ].sort()) {
        const exercise = await tx.orm.public.Exercise.where({ id }).update({
          id,
        });
        if (!exercise?.isActive)
          throw new ConflictException(
            'The exercise catalog changed; generate again',
          );
      }
      if (!(await tx.orm.public.User.first({ id: userId })))
        throw new NotFoundException('User not found');
      const findWorkout = (id: string) =>
        tx.orm.public.Workout.include('workoutExercises', (entries) =>
          entries.orderBy((e) => e.exerciseOrder.asc()).include('exercise'),
        ).first({ id });
      const saved: Awaited<ReturnType<typeof findWorkout>>[] = [];
      for (const plan of plans) {
        const workout = await tx.orm.public.Workout.create({
          userId: userId,
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
        saved.push(await findWorkout(workout.id));
      }
      return saved;
    });
  }
}
