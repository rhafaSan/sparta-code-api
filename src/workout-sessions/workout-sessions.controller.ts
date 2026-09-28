import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { WorkoutSessionsService } from './workout-sessions.service.js';
import { HistoryQueryDto } from '../common/dto/list-query.dto.js';
import {
  FinishWorkoutSessionDto,
  RecordSetDto,
  StartWorkoutSessionDto,
  UpdateExerciseSessionDto,
} from './dto/workout-session.dto.js';

@ApiTags('Sessões de treino')
@Controller('workout-sessions')
export class WorkoutSessionsController {
  constructor(private readonly sessions: WorkoutSessionsService) {}
  @ApiOperation({ summary: 'Iniciar sessão com snapshots do plano' })
  @ApiResponse({
    status: 201,
    description:
      'Iniciar sessão com snapshots do plano: operação realizada com sucesso.',
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
  @Post('start')
  start(@Body() dto: StartWorkoutSessionDto) {
    return this.sessions.start(dto);
  }
  @ApiOperation({ summary: 'Consultar histórico do usuário' })
  @ApiResponse({
    status: 200,
    description:
      'Consultar histórico do usuário: operação realizada com sucesso.',
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
  list(@Query() query: HistoryQueryDto) {
    return this.sessions.list(query);
  }
  @ApiOperation({ summary: 'Consultar execuções anteriores do exercício' })
  @ApiResponse({
    status: 200,
    description:
      'Consultar execuções anteriores do exercício: operação realizada com sucesso.',
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
    name: 'exerciseId',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @Get('exercises/:exerciseId/performance')
  performance(
    @Param('exerciseId', ParseUUIDPipe) id: string,
    @Query() query: HistoryQueryDto,
  ) {
    return this.sessions.performance(id, query);
  }
  @ApiOperation({
    summary: 'Consultar estatísticas do exercício',
    description:
      'Somente séries concluídas de sessões finalizadas. Ignora paginação. totalReps é string inteira; maxWeight é string decimal ou null.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Consultar estatísticas do exercício: operação realizada com sucesso.',
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
    name: 'exerciseId',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @Get('exercises/:exerciseId/statistics')
  statistics(
    @Param('exerciseId', ParseUUIDPipe) id: string,
    @Query() query: HistoryQueryDto,
  ) {
    return this.sessions.statistics(id, query);
  }
  @ApiOperation({ summary: 'Consultar sessão, séries e duração' })
  @ApiResponse({
    status: 200,
    description:
      'Consultar sessão, séries e duração: operação realizada com sucesso.',
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
    return this.sessions.get(id);
  }
  @ApiOperation({ summary: 'Criar ou atualizar série por setNumber' })
  @ApiResponse({
    status: 200,
    description:
      'Criar ou atualizar série por setNumber: operação realizada com sucesso.',
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
    name: 'sessionId',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @ApiParam({
    name: 'exerciseSessionId',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @Put(':sessionId/exercises/:exerciseSessionId/sets')
  recordSet(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('exerciseSessionId', ParseUUIDPipe) id: string,
    @Body() dto: RecordSetDto,
  ) {
    return this.sessions.recordSet(sessionId, id, dto);
  }
  @ApiOperation({
    summary: 'Atualizar conclusão, descanso ou notas do exercício',
  })
  @ApiResponse({
    status: 200,
    description:
      'Atualizar conclusão ou notas do exercício: operação realizada com sucesso.',
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
    name: 'sessionId',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @ApiParam({
    name: 'exerciseSessionId',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @Patch(':sessionId/exercises/:exerciseSessionId')
  updateExercise(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('exerciseSessionId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExerciseSessionDto,
  ) {
    return this.sessions.updateExercise(sessionId, id, dto);
  }
  @ApiOperation({ summary: 'Finalizar sessão de forma idempotente' })
  @ApiResponse({
    status: 200,
    description:
      'Finalizar sessão de forma idempotente: operação realizada com sucesso.',
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
  @Post(':id/finish')
  @HttpCode(200)
  finish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FinishWorkoutSessionDto,
  ) {
    return this.sessions.finish(id, dto);
  }
}
