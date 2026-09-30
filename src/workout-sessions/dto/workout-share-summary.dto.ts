import { ApiProperty } from '@nestjs/swagger';

export class WorkoutShareSummary {
  @ApiProperty({ format: 'uuid' })
  workoutSessionId: string;

  @ApiProperty()
  workoutName: string;

  @ApiProperty({ example: 4080 })
  durationSeconds: number;

  @ApiProperty({ type: [String], example: ['biceps', 'lats', 'middle-back'] })
  muscles: string[];
}
