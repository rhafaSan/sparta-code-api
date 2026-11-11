import { Type } from 'class-transformer';
import { IsInt, IsTimeZone, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScheduleDayDto {
  @ApiProperty({
    minimum: 1,
    maximum: 7,
    description: 'ISO: segunda = 1, domingo = 7.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;
}

export class AssignWorkoutDayDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Treino ativo do usuário autenticado.',
  })
  @IsUUID()
  workoutId!: string;
}

export class TodayWorkoutQueryDto {
  @ApiPropertyOptional({
    default: 'America/Sao_Paulo',
    description: 'Fuso horário usado para determinar o dia atual.',
  })
  @IsTimeZone()
  timeZone = 'America/Sao_Paulo';
}
