import { IsIn, IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';
import { catalogMuscleMappings } from '../exercises/exercise-catalog.js';

export class MuscleGroupInput {
  @Matches(/^[a-z]+(?:-[a-z]+)*$/)
  slug: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['front', 'back', 'both'])
  view: 'front' | 'back' | 'both';
}

export class ExerciseMuscleInput {
  @IsUUID()
  exerciseId: string;

  @Matches(/^[a-z]+(?:-[a-z]+)*$/)
  muscleSlug: string;

  @IsIn(['primary', 'secondary'])
  role: 'primary' | 'secondary';
}

export const muscleGroups: MuscleGroupInput[] = [
  { slug: 'chest', name: 'Peito', view: 'front' },
  { slug: 'lats', name: 'Dorsais', view: 'back' },
  { slug: 'middle-back', name: 'Meio das costas', view: 'back' },
  { slug: 'lower-back', name: 'Lombar', view: 'back' },
  { slug: 'traps', name: 'Trapézio', view: 'back' },
  { slug: 'shoulders', name: 'Ombros', view: 'both' },
  { slug: 'biceps', name: 'Bíceps', view: 'front' },
  { slug: 'triceps', name: 'Tríceps', view: 'back' },
  { slug: 'forearms', name: 'Antebraços', view: 'both' },
  { slug: 'abdominals', name: 'Abdominais', view: 'front' },
  { slug: 'glutes', name: 'Glúteos', view: 'back' },
  { slug: 'quadriceps', name: 'Quadríceps', view: 'front' },
  { slug: 'hamstrings', name: 'Posteriores da coxa', view: 'back' },
  { slug: 'calves', name: 'Panturrilhas', view: 'back' },
  { slug: 'adductors', name: 'Adutores', view: 'front' },
  { slug: 'abductors', name: 'Abdutores', view: 'both' },
  { slug: 'neck', name: 'Pescoço', view: 'both' },
];

export const exerciseMuscles: ExerciseMuscleInput[] = catalogMuscleMappings;
