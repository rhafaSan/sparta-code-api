import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ActiveQueryDto } from '../../common/dto/list-query.dto.js';

export class ExerciseQueryDto extends ActiveQueryDto {
  @ApiPropertyOptional({
    example: 'supino',
    maxLength: 200,
    description:
      'Busca parcial pelo nome, sem distinguir maiúsculas e minúsculas. Acentos são considerados.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({
    example: 'Peitoral',
    maxLength: 100,
    description:
      'Grupo muscular completo, sem distinguir maiúsculas e minúsculas.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  muscleGroup?: string;

  @ApiPropertyOptional({
    type: 'boolean',
    default: false,
    description:
      'true retorna apenas os exercícios cujos UUIDs pertencem ao catálogo da seed. false inclui também os cadastrados manualmente.',
  })
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  catalogOnly = false;
}
