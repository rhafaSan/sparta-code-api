import { db } from './db.js';
import { seedMuscles } from './seed-muscles.js';

try {
  console.log('Muscle seed completed:', await seedMuscles(db));
} catch (error) {
  console.error('Muscle seed failed:', error);
  process.exitCode = 1;
} finally {
  await db.close();
}
