import { ApiProperty } from '@nestjs/swagger';

export class WorkoutShareSummary {
  @ApiProperty({ format: 'uuid' })
  workoutSessionId: string;

  @ApiProperty()
  workoutName: string;

  @ApiProperty({ example: 4080 })
  durationSeconds: number;

  @ApiProperty({
    type: [String],
    example: ['biceps', 'lats', 'middle-back'],
    description:
      'Slugs únicos e ordenados dos músculos de exercícios concluídos ou com séries concluídas. Usa vínculos explícitos, depois catálogo por ID e por último grupos legados reconhecidos. Pode ser vazio se nada foi executado ou não há informação muscular reconhecida.',
  })
  muscles: string[];
}
