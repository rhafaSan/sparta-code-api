import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateExerciseDto {
  @ApiProperty({
    type: 'string',
    maxLength: 200,
    pattern: '\\S',
    example: 'Supino reto',
  })
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  name!: string;
  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    maxLength: 5000,
    example: 'Executar com movimento controlado.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;
  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    maxLength: 100,
    example: 'Peito',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  muscleGroup?: string | null;
}

export class UpdateExerciseDto {
  @ApiPropertyOptional({
    type: 'string',
    maxLength: 200,
    pattern: '\\S',
    example: 'Supino reto',
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
    example: 'Executar com movimento controlado.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;
  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    maxLength: 100,
    example: 'Peito',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  muscleGroup?: string | null;
  @ApiPropertyOptional({
    type: 'boolean',
    example: true,
    description: 'Use false para arquivar, preservando o histórico.',
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
