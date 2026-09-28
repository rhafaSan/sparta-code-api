import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { WorkoutsService } from './workouts.service.js';
import {
  AddWorkoutExerciseDto,
  CreateWorkoutDto,
  ReorderWorkoutExercisesDto,
  UpdateWorkoutDto,
  UpdateWorkoutExerciseDto,
} from './dto/workout.dto.js';
import { WorkoutQueryDto } from '../common/dto/list-query.dto.js';

@ApiTags('Treinos')
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}
  @ApiOperation({ summary: 'Criar modelo de treino' })
  @ApiResponse({
    status: 201,
    description: 'Criar modelo de treino: operação realizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Entrada inválida, UUID inválido ou campo desconhecido.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Recurso não encontrado ou vínculo fora do recurso pai informado.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflito de ordem ou escrita, entidade arquivada, plano vazio ou sessão finalizada.',
  })
  @Post()
  create(@Body() dto: CreateWorkoutDto) {
    return this.workouts.create(dto);
  }
  @ApiOperation({ summary: 'Listar treinos do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Listar treinos do usuário: operação realizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Entrada inválida, UUID inválido ou campo desconhecido.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Recurso não encontrado ou vínculo fora do recurso pai informado.',
  })
  @Get()
  list(@Query() query: WorkoutQueryDto) {
    return this.workouts.list(query);
  }
  @ApiOperation({ summary: 'Consultar treino com exercícios ativos' })
  @ApiResponse({
    status: 200,
    description:
      'Consultar treino com exercícios ativos: operação realizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Entrada inválida, UUID inválido ou campo desconhecido.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Recurso não encontrado ou vínculo fora do recurso pai informado.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.workouts.get(id);
  }
  @ApiOperation({ summary: 'Editar ou arquivar treino' })
  @ApiResponse({
    status: 200,
    description: 'Editar ou arquivar treino: operação realizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Entrada inválida, UUID inválido ou campo desconhecido.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Recurso não encontrado ou vínculo fora do recurso pai informado.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflito de ordem ou escrita, entidade arquivada, plano vazio ou sessão finalizada.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkoutDto,
  ) {
    return this.workouts.update(id, dto);
  }
  @ApiOperation({ summary: 'Adicionar exercício ao treino' })
  @ApiResponse({
    status: 201,
    description:
      'Adicionar exercício ao treino: operação realizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Entrada inválida, UUID inválido ou campo desconhecido.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Recurso não encontrado ou vínculo fora do recurso pai informado.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflito de ordem ou escrita, entidade arquivada, plano vazio ou sessão finalizada.',
  })
  @ApiParam({
    name: 'workoutId',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @Post(':workoutId/exercises')
  addExercise(
    @Param('workoutId', ParseUUIDPipe) id: string,
    @Body() dto: AddWorkoutExerciseDto,
  ) {
    return this.workouts.addExercise(id, dto);
  }
  @ApiOperation({ summary: 'Reordenar todos os vínculos ativos' })
  @ApiResponse({
    status: 200,
    description:
      'Reordenar todos os vínculos ativos: operação realizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Entrada inválida, UUID inválido ou campo desconhecido.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Recurso não encontrado ou vínculo fora do recurso pai informado.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflito de ordem ou escrita, entidade arquivada, plano vazio ou sessão finalizada.',
  })
  @ApiParam({
    name: 'workoutId',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @Put(':workoutId/exercises/order')
  reorder(
    @Param('workoutId', ParseUUIDPipe) id: string,
    @Body() dto: ReorderWorkoutExercisesDto,
  ) {
    return this.workouts.reorder(id, dto);
  }
  @ApiOperation({ summary: 'Editar configuração do exercício no treino' })
  @ApiResponse({
    status: 200,
    description:
      'Editar configuração do exercício no treino: operação realizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Entrada inválida, UUID inválido ou campo desconhecido.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Recurso não encontrado ou vínculo fora do recurso pai informado.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflito de ordem ou escrita, entidade arquivada, plano vazio ou sessão finalizada.',
  })
  @ApiParam({
    name: 'workoutId',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @ApiParam({
    name: 'workoutExerciseId',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @Patch(':workoutId/exercises/:workoutExerciseId')
  updateExercise(
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Param('workoutExerciseId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkoutExerciseDto,
  ) {
    return this.workouts.updateExercise(workoutId, id, dto);
  }
  @ApiOperation({ summary: 'Arquivar vínculo sem remover o histórico' })
  @ApiResponse({
    status: 200,
    description:
      'Arquivar vínculo sem remover o histórico: operação realizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Entrada inválida, UUID inválido ou campo desconhecido.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Recurso não encontrado ou vínculo fora do recurso pai informado.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflito de ordem ou escrita, entidade arquivada, plano vazio ou sessão finalizada.',
  })
  @ApiParam({
    name: 'workoutId',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @ApiParam({
    name: 'workoutExerciseId',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @Delete(':workoutId/exercises/:workoutExerciseId')
  archive(
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Param('workoutExerciseId', ParseUUIDPipe) id: string,
  ) {
    return this.workouts.archiveExercise(workoutId, id);
  }
}
