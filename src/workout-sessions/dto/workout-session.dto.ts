import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
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

export class StartWorkoutSessionDto {
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
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 2147483647, example: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  setNumber!: number;
  // Decimal crosses HTTP as a string, with no Number/parseFloat conversion.
  @ApiProperty({
    type: 'string',
    maxLength: 40,
    pattern: '^(0|[1-9]\\d*)(\\.\\d+)?$',
    example: '80.25',
    description:
      'Peso decimal não negativo em kg. Envie como string, sem notação exponencial, para preservar a precisão.',
  })
  @IsString()
  @MaxLength(40)
  @Matches(/^(0|[1-9]\d*)(\.\d+)?$/)
  weight!: string;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    maximum: 2147483647,
    example: 10,
  })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  reps!: number;
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
