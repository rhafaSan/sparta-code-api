import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class ProgressReportQueryDto {
  @ApiProperty({ format: 'date', example: '2026-09-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startDate!: string;

  @ApiProperty({ format: 'date', example: '2026-09-30' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  endDate!: string;

  @ApiPropertyOptional({ enum: ['week', 'month'], default: 'week' })
  @IsIn(['week', 'month'])
  groupBy: 'week' | 'month' = 'week';

  @ApiPropertyOptional({
    default: 'America/Sao_Paulo',
    description: 'Fuso IANA usado para as datas e os intervalos do relatório.',
  })
  @IsString()
  @MaxLength(100)
  timeZone = 'America/Sao_Paulo';

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  workoutId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  exerciseId?: string;
}

export class ProgressMetrics {
  @ApiProperty({ description: 'Treinos com séries concluídas neste recorte.' })
  workoutSessions!: number;

  @ApiProperty()
  completedSets!: number;

  @ApiProperty({ example: '120', description: 'Total inteiro exato.' })
  totalReps!: string;

  @ApiProperty({ type: String, nullable: true, example: '10.50' })
  averageReps!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '80.25' })
  maxWeight!: string | null;
}

export class ProgressPeriod {
  @ApiProperty({ format: 'date' })
  startDate!: string;

  @ApiProperty({ format: 'date' })
  endDate!: string;
}

export class ExerciseProgressPeriod extends ProgressPeriod {
  @ApiProperty({ type: ProgressMetrics })
  metrics!: ProgressMetrics;
}

export class ProgressComparison {
  @ApiProperty({ type: String, format: 'date', nullable: true })
  fromPeriodStart!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  toPeriodStart!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '12.50',
    description:
      'Variação da maior carga entre o primeiro e o último intervalo com séries.',
  })
  weightPercent!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '20.00',
    description:
      'Variação da média de repetições por série entre esses intervalos.',
  })
  repsPercent!: string | null;
}

export class ExerciseProgressReport {
  @ApiProperty({ format: 'uuid' })
  exerciseId!: string;

  @ApiProperty()
  exerciseName!: string;

  @ApiProperty({ type: ProgressMetrics })
  totals!: ProgressMetrics;

  @ApiProperty({ type: [ExerciseProgressPeriod] })
  periods!: ExerciseProgressPeriod[];

  @ApiProperty({ type: ProgressComparison })
  progression!: ProgressComparison;
}

export class ProgressReport {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'date' })
  startDate!: string;

  @ApiProperty({ format: 'date' })
  endDate!: string;

  @ApiProperty()
  timeZone!: string;

  @ApiProperty({ enum: ['week', 'month'] })
  groupBy!: 'week' | 'month';

  @ApiProperty({ type: [ProgressPeriod] })
  periods!: ProgressPeriod[];

  @ApiProperty({ type: ProgressMetrics })
  totals!: ProgressMetrics;

  @ApiProperty({ type: [ExerciseProgressReport] })
  exercises!: ExerciseProgressReport[];
}
