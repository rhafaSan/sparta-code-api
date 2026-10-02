import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { db } from './db.js';
import {
  ExerciseMuscleInput,
  MuscleGroupInput,
  exerciseMuscles,
  muscleGroups,
} from './muscle-data.js';

export async function seedMuscles(
  database: Pick<typeof db, 'transaction'>,
  mappings?: ExerciseMuscleInput[],
  groups: MuscleGroupInput[] = muscleGroups,
) {
  const options = { whitelist: true, forbidNonWhitelisted: true };
  for (const group of groups) {
    if (validateSync(plainToInstance(MuscleGroupInput, group), options).length)
      throw new Error('Invalid muscle group');
  }
  for (const mapping of mappings ?? exerciseMuscles) {
    if (
      validateSync(plainToInstance(ExerciseMuscleInput, mapping), options)
        .length
    )
      throw new Error('Invalid exercise muscle mapping');
  }

  return database.transaction(async (tx) => {
    // Default seed only maps catalog exercises already present in this database.
    // Explicit mappings still fail on missing IDs to catch configuration errors.
    const existingIds = mappings
      ? null
      : new Set(
          (await tx.orm.public.Exercise.select('id').all()).map((e) => e.id),
        );
    const selectedMappings =
      mappings ?? exerciseMuscles.filter((m) => existingIds!.has(m.exerciseId));
    for (const group of groups) {
      await tx.orm.public.MuscleGroup.upsert({
        conflictOn: { slug: group.slug },
        create: group,
        update: { slug: group.slug },
      });
    }
    for (const mapping of selectedMappings) {
      const exercise = await tx.orm.public.Exercise.first({
        id: mapping.exerciseId,
      });
      const muscle = await tx.orm.public.MuscleGroup.first({
        slug: mapping.muscleSlug,
      });
      if (!exercise || !muscle)
        throw new Error('Exercise or muscle group not found for mapping');
      await tx.orm.public.ExerciseMuscle.upsert({
        conflictOn: { exerciseId: exercise.id, muscleGroupId: muscle.id },
        create: {
          exerciseId: exercise.id,
          muscleGroupId: muscle.id,
          role: mapping.role,
        },
        // Seeds preserve existing curated roles; corrections are explicit updates.
        update: { exerciseId: exercise.id },
      });
    }
    return { groups: groups.length, mappings: selectedMappings.length };
  });
}
