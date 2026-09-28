import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateWorkoutDto {
  @ApiProperty({
    type: 'string',
    format: 'uuid',
    example: '123e4567-e89b-42d3-a456-426614174000',
  })
  @IsUUID()
  userId!: string;
  @ApiProperty({
    type: 'string',
    maxLength: 200,
    pattern: '\\S',
    example: 'Treino de Peito',
  })
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  name!: string;
  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    maxLength: 5000,
    example: 'Manter a técnica durante as séries.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

export class UpdateWorkoutDto {
  @ApiPropertyOptional({
    type: 'string',
    maxLength: 200,
    pattern: '\\S',
    example: 'Treino de Peito',
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  name?: string;
  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    maxLength: 5000,
    example: 'Manter a técnica durante as séries.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
  @ApiPropertyOptional({
    type: 'boolean',
    example: true,
    description: 'Use false para arquivar, preservando o histórico.',
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class AddWorkoutExerciseDto {
  @ApiProperty({
    type: 'string',
    format: 'uuid',
    example: '123e4567-e89b-42d3-a456-426614174000',
  })
  @IsUUID()
  exerciseId!: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 2147483647, example: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  exerciseOrder!: number;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 1000, example: 4 })
  @IsInt()
  @Min(1)
  @Max(1000)
  plannedSets!: number;
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: 2147483647,
    example: 10,
  })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  plannedReps!: number;
  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    minimum: 0,
    maximum: 2147483647,
    example: 90,
    description:
      'Descanso entre séries em segundos. Zero indica sem descanso; null remove a configuração. Omitir preserva o valor ao atualizar.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  restSeconds?: number | null;
  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    maxLength: 5000,
    example: 'Manter a técnica durante as séries.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

export class UpdateWorkoutExerciseDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 2147483647,
    example: 1,
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  exerciseOrder?: number;
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 1000,
    example: 4,
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(1000)
  plannedSets?: number;
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 2147483647,
    example: 10,
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  plannedReps?: number;
  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    minimum: 0,
    maximum: 2147483647,
    example: 90,
    description:
      'Descanso entre séries em segundos. Zero indica sem descanso; null remove a configuração. Omitir preserva o valor ao atualizar.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  restSeconds?: number | null;
  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    maxLength: 5000,
    example: 'Manter a técnica durante as séries.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
  @ApiPropertyOptional({
    type: 'boolean',
    example: true,
    description: 'Use false para arquivar, preservando o histórico.',
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderWorkoutExercisesDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'uuid' },
    minItems: 1,
    maxItems: 1000,
    uniqueItems: true,
    example: ['123e4567-e89b-42d3-a456-426614174000'],
    description:
      'Todos os IDs dos vínculos ativos, uma única vez, na ordem desejada.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  workoutExerciseIds!: string[];
}
