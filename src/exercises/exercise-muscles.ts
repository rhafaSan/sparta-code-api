import {
  catalogMuscleMappings,
  catalogMuscleTaxonomy,
} from './exercise-catalog.js';
import { muscleGroups } from '../prisma/muscle-data.js';

const normalize = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
const aliases = new Map<string, string>();
for (const group of muscleGroups) {
  aliases.set(normalize(group.slug), group.slug);
  aliases.set(normalize(group.name), group.slug);
}
for (const group of catalogMuscleTaxonomy) {
  aliases.set(normalize(group.namePt), group.slug);
  for (const name of group.namePt.split('/'))
    aliases.set(normalize(name), group.slug);
}
const catalogMuscles = new Map<string, string[]>();
for (const mapping of catalogMuscleMappings) {
  const slugs = catalogMuscles.get(mapping.exerciseId) ?? [];
  slugs.push(mapping.muscleSlug);
  catalogMuscles.set(mapping.exerciseId, slugs);
}

// Explicit database mappings take precedence. Never guess from exercise names
// or descriptions; unknown legacy labels cannot identify anatomical targets.
export function resolveExerciseMuscles(
  exercise: { id: string; muscleGroup: string | null },
  mappedSlugs: string[],
): string[] {
  if (mappedSlugs.length) return [...new Set(mappedSlugs)].sort();
  const catalog = catalogMuscles.get(exercise.id);
  if (catalog) return [...new Set(catalog)].sort();
  const legacy = (exercise.muscleGroup ?? '').split(/[,;/]/).flatMap((name) => {
    const slug = aliases.get(normalize(name));
    return slug ? [slug] : [];
  });
  return [...new Set(legacy)].sort();
}
