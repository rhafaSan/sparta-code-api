import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ImportWorkoutDto {
  @ApiPropertyOptional({
    maxLength: 30000,
    example: 'Treino A\nSupino reto 3 x 10',
  })
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(30000)
  text?: string;
}
