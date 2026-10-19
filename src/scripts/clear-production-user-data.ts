import { db } from '../prisma/db.js';

async function main() {
  console.log('Iniciando limpeza...');

  await db.transaction(async (tx) => {
    // O filtro vazio remove todos os registros das tabelas selecionadas.
    await tx.orm.public.ExerciseSet.where({}).deleteAndCount();
    await tx.orm.public.ExerciseSession.where({}).deleteAndCount();
    await tx.orm.public.WorkoutSession.where({}).deleteAndCount();
    await tx.orm.public.WorkoutExercise.where({}).deleteAndCount();
    await tx.orm.public.Workout.where({}).deleteAndCount();
    await tx.orm.public.User.where({}).deleteAndCount();
  });

  console.log('Limpeza concluída.');
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.close();
}
