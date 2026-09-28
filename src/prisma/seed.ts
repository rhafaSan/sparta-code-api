import { db } from './db.js';
import { seedExercises } from './seed-exercises.js';

try {
  const result = await seedExercises(db);
  console.log(
    `Seed concluída: ${result.processed} exercícios processados. Registros existentes preservados.`,
  );
} catch (error) {
  console.error('Falha ao executar a seed:', error);
  process.exitCode = 1;
} finally {
  await db.close();
}
