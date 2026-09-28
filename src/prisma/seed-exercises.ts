import type { db } from './db.js';
import { catalogExercises } from '../exercises/exercise-catalog.js';

export async function seedExercises(database: Pick<typeof db, 'transaction'>) {
  await database.transaction(async (tx) => {
    for (const entry of catalogExercises) {
      // The catalog UUID is the identity, even after renaming or archiving.
      // An upsert also prevents duplicates when two seed processes overlap.
      // Only the ID is assigned on conflict: user edits remain untouched.
      await tx.orm.public.Exercise.upsert({
        create: entry,
        update: { id: entry.id },
      });
    }
  });
  return { processed: catalogExercises.length };
}
