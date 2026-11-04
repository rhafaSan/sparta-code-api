import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const setTypes = ['working', 'warmup', 'preparatory'] as const;
export type SetType = (typeof setTypes)[number];

export class AdditionalSetDto {
  @ApiProperty({ minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  setNumber!: number;

  @ApiProperty({ enum: ['warmup', 'preparatory'] })
  @IsIn(['warmup', 'preparatory'])
  setType!: 'warmup' | 'preparatory';
}

export class AdditionalExerciseSetsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  workoutExerciseId!: string;

  @ApiProperty({ type: [AdditionalSetDto], maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((set: AdditionalSetDto) => set?.setNumber)
  @ValidateNested({ each: true })
  @Type(() => AdditionalSetDto)
  sets!: AdditionalSetDto[];
}

export class StartWorkoutSessionDto {
  @ApiPropertyOptional({
    type: [AdditionalExerciseSetsDto],
    description:
      'Séries adicionais por vínculo do plano, preservadas apenas nesta sessão.',
    maxItems: 100,
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique(
    (exercise: AdditionalExerciseSetsDto) => exercise?.workoutExerciseId,
  )
  @ValidateNested({ each: true })
  @Type(() => AdditionalExerciseSetsDto)
  additionalSets?: AdditionalExerciseSetsDto[];
  @ApiProperty({
    type: 'string',
    format: 'uuid',
    example: '123e4567-e89b-42d3-a456-426614174000',
  })
  @IsUUID()
  userId!: string;
  @ApiProperty({
    type: 'string',
    format: 'uuid',
    example: '123e4567-e89b-42d3-a456-426614174000',
  })
  @IsUUID()
  workoutId!: string;
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

export class UpdateExerciseSessionDto {
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
    type: 'boolean',
    example: true,
    description:
      'Conclusão desta série ou execução. Na criação de série, o padrão é false; ao atualizar, omitir preserva o valor.',
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsBoolean()
  completed?: boolean;
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

export class RecordSetDto {
  @ApiPropertyOptional({
    enum: setTypes,
    default: 'working',
    description: 'Omitir preserva o tipo existente; novas séries usam working.',
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsIn(setTypes)
  setType?: SetType;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 2147483647, example: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  setNumber!: number;
  // Decimal crosses HTTP as a string, with no Number/parseFloat conversion.
  @ApiPropertyOptional({
    type: 'string',
    maxLength: 40,
    pattern: '^(0|[1-9]\\d*)(\\.\\d+)?$',
    example: '80.25',
    description:
      'Peso decimal não negativo em kg. Envie como string, sem notação exponencial, para preservar a precisão.',
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsString()
  @MaxLength(40)
  @Matches(/^(0|[1-9]\d*)(\.\d+)?$/)
  weight?: string;
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    maximum: 2147483647,
    example: 10,
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  reps?: number;
  @ApiPropertyOptional({
    type: 'boolean',
    example: true,
    description:
      'Conclusão desta série ou execução. Na criação de série, o padrão é false; ao atualizar, omitir preserva o valor.',
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsBoolean()
  completed?: boolean;
}

export class FinishWorkoutSessionDto {
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
