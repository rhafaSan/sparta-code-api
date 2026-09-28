import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ExercisesService } from './exercises.service.js';
import { CreateExerciseDto, UpdateExerciseDto } from './dto/exercise.dto.js';
import { ExerciseQueryDto } from './dto/exercise-query.dto.js';

@ApiTags('Exercícios')
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}
  @ApiOperation({ summary: 'Criar exercício reutilizável' })
  @ApiResponse({
    status: 201,
    description:
      'Criar exercício reutilizável: operação realizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Entrada inválida, UUID inválido ou campo desconhecido.',
  })
  @Post()
  create(@Body() dto: CreateExerciseDto) {
    return this.exercises.create(dto);
  }
  @ApiOperation({ summary: 'Listar exercícios' })
  @ApiResponse({
    status: 200,
    description: 'Listar exercícios: operação realizada com sucesso.',
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
  list(@Query() query: ExerciseQueryDto) {
    return this.exercises.list(query);
  }
  @ApiOperation({ summary: 'Consultar exercício' })
  @ApiResponse({
    status: 200,
    description: 'Consultar exercício: operação realizada com sucesso.',
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
    return this.exercises.get(id);
  }
  @ApiOperation({ summary: 'Editar ou arquivar exercício' })
  @ApiResponse({
    status: 200,
    description:
      'Editar ou arquivar exercício: operação realizada com sucesso.',
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
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExerciseDto,
  ) {
    return this.exercises.update(id, dto);
  }
}
