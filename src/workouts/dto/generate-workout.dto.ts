import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class GenerateWorkoutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    maxLength: 2000,
    example: 'Treino de pernas para iniciante, com máquinas, em 45 minutos.',
  })
  @IsString()
  @Matches(/\S/)
  @MaxLength(2000)
  prompt!: string;
}
