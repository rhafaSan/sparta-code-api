import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GenerateWorkoutDto } from '../dto/generate-workout.dto.js';
import { WorkoutGenerationService } from './workout-generation.service.js';

@ApiTags('Treinos')
@Controller('workouts')
export class WorkoutGenerationController {
  constructor(private readonly generation: WorkoutGenerationService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Gerar e salvar um treino a partir de um prompt' })
  @ApiResponse({
    status: 201,
    description:
      'Treino salvo com workoutExercises e seus exercícios. Use o id para iniciar uma sessão.',
  })
  @ApiResponse({ status: 400, description: 'Prompt ou userId inválido.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  @ApiResponse({
    status: 409,
    description: 'Catálogo vazio, grande demais ou alterado durante a geração.',
  })
  @ApiResponse({ status: 422, description: 'Pedido não pode ser atendido.' })
  @ApiResponse({ status: 429, description: 'Cota do provedor atingida.' })
  @ApiResponse({
    status: 502,
    description: 'Resposta inválida do modelo; nada foi salvo.',
  })
  @ApiResponse({
    status: 503,
    description: 'Provedor indisponível ou não configurado.',
  })
  @ApiResponse({
    status: 504,
    description: 'Tempo limite de geração excedido.',
  })
  generate(@Body() dto: GenerateWorkoutDto) {
    return this.generation.generate(dto);
  }
}
