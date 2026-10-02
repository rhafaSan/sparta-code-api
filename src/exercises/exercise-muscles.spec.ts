import { catalogExercises, catalogMuscleMappings } from './exercise-catalog.js';
import { resolveExerciseMuscles } from './exercise-muscles.js';
import { muscleGroups } from '../prisma/muscle-data.js';

describe('Exercise muscle resolution', () => {
  it('resolves primary and secondary targets for every catalog exercise without a seed', () => {
    const validSlugs = new Set(muscleGroups.map((group) => group.slug));
    for (const exercise of catalogExercises) {
      const expected = [
        ...new Set(
          catalogMuscleMappings
            .filter((mapping) => mapping.exerciseId === exercise.id)
            .map((mapping) => mapping.muscleSlug),
        ),
      ].sort();
      const result = resolveExerciseMuscles(
        { ...exercise, muscleGroup: null },
        [],
      );
      expect(result).toEqual(expected);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((slug) => validSlugs.has(slug))).toBe(true);
    }
  });

  it('preserves explicit curated mappings instead of mixing them with fallbacks', () => {
    expect(
      resolveExerciseMuscles(catalogExercises[0], [
        'triceps',
        'chest',
        'chest',
      ]),
    ).toEqual(['chest', 'triceps']);
  });

  it.each([
    [' PEITO, Tríceps; Ombros ', ['chest', 'shoulders', 'triceps']],
    ['Peitoral, Posteriores de coxa', ['chest', 'hamstrings']],
    ['Latíssimos / dorsais, Costas médias', ['lats', 'middle-back']],
    ['biceps, BÍCEPS, quadriceps', ['biceps', 'quadriceps']],
    [null, []],
    ['Desconhecido', []],
  ])('normalizes known legacy labels: %s', (muscleGroup, expected) => {
    expect(resolveExerciseMuscles({ id: 'custom', muscleGroup }, [])).toEqual(
      expected,
    );
  });
});
