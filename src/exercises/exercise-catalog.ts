import { readFileSync } from 'node:fs';
import { isUUID } from 'class-validator';

interface Catalog {
  metadata: {
    exerciseCount: number;
    muscleTaxonomy: { slug: string; namePt: string }[];
  };
  exercises: {
    id: string;
    slug: string;
    namePt: string;
    nameEn: string;
    type: string;
    difficultyLevel: string;
    forceType: string;
    mechanics: string;
    category: string;
    primaryMuscles: string[];
    secondaryMuscles: string[];
    equipment: string[];
    isActive: boolean;
  }[];
}

// The same relative path works from src/exercises and dist/exercises.
const catalog = JSON.parse(
  readFileSync(
    new URL('../../exercises_catalog_pt.json', import.meta.url),
    'utf8',
  ),
) as Catalog;
const muscles = new Map(
  catalog.metadata.muscleTaxonomy.map((muscle) => [muscle.slug, muscle.namePt]),
);
const ids = new Set<string>();
const slugs = new Set<string>();

export const catalogExercises = catalog.exercises.map((entry) => {
  if (
    !isUUID(entry.id) ||
    ids.has(entry.id) ||
    !entry.slug ||
    slugs.has(entry.slug) ||
    !entry.namePt?.trim() ||
    entry.namePt.length > 200 ||
    typeof entry.isActive !== 'boolean' ||
    !entry.primaryMuscles.length ||
    entry.primaryMuscles.some((muscle) => !muscles.has(muscle))
  ) {
    throw new Error(`Invalid exercise catalog entry: ${entry.id}`);
  }
  ids.add(entry.id);
  slugs.add(entry.slug);
  const muscleGroup = entry.primaryMuscles
    .map((m) => muscles.get(m))
    .join(', ');
  const description = [
    `Nome em inglês: ${entry.nameEn}.`,
    `Equipamentos: ${entry.equipment.join(', ')}.`,
    `Músculos secundários: ${entry.secondaryMuscles.map((m) => muscles.get(m) ?? m).join(', ') || 'nenhum informado'}.`,
    `Categoria: ${entry.category}; dificuldade: ${entry.difficultyLevel}; mecânica: ${entry.mechanics}; força: ${entry.forceType}; modalidade: ${entry.type}.`,
  ].join('\n');
  if (muscleGroup.length > 100 || description.length > 5000)
    throw new Error(`Catalog entry exceeds field limits: ${entry.id}`);
  return {
    id: entry.id,
    name: entry.namePt.trim(),
    muscleGroup,
    description,
    isActive: entry.isActive,
  };
});

if (catalogExercises.length !== catalog.metadata.exerciseCount)
  throw new Error('Exercise catalog count does not match its metadata');

export const catalogExerciseIds = catalogExercises.map((entry) => entry.id);
