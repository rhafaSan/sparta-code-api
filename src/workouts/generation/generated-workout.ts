import { BadGatewayException } from '@nestjs/common';
import { plainToInstance, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  validateSync,
} from 'class-validator';

class GeneratedExercise {
  @IsUUID()
  exerciseId!: string;
  @IsInt()
  @Min(1)
  @Max(10)
  plannedSets!: number;
  @IsInt()
  @Min(1)
  @Max(100)
  plannedReps!: number;
  @IsInt()
  @Min(0)
  @Max(600)
  restSeconds!: number;
  @IsString()
  @MaxLength(1000)
  notes!: string;
}

export class GeneratedWorkout {
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  name!: string;
  @IsString()
  @MaxLength(3000)
  notes!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GeneratedExercise)
  exercises!: GeneratedExercise[];
}

export function validateGeneratedWorkout(value: unknown): GeneratedWorkout {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadGatewayException('AI returned an invalid workout');
  const workout = plainToInstance(GeneratedWorkout, value);
  if (
    validateSync(workout, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }).length
  )
    throw new BadGatewayException('AI returned an invalid workout');
  return workout;
}

// Syntax is constrained at the provider; values are independently validated here.
export const workoutResponseSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    notes: { type: 'string' },
    exercises: {
      type: 'array',
      minItems: 0,
      maxItems: 20,
      items: {
        type: 'object',
        properties: {
          exerciseId: { type: 'string' },
          plannedSets: { type: 'integer', minimum: 1, maximum: 10 },
          plannedReps: { type: 'integer', minimum: 1, maximum: 100 },
          restSeconds: { type: 'integer', minimum: 0, maximum: 600 },
          notes: { type: 'string' },
        },
        required: [
          'exerciseId',
          'plannedSets',
          'plannedReps',
          'restSeconds',
          'notes',
        ],
      },
    },
  },
  required: ['name', 'notes', 'exercises'],
};
