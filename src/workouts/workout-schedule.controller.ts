import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/auth.decorators.js';
import {
  AssignWorkoutDayDto,
  ScheduleDayDto,
  TodayWorkoutQueryDto,
} from './dto/workout-schedule.dto.js';
import { WorkoutScheduleService } from './workout-schedule.service.js';

@ApiTags('Agenda de treinos')
@ApiBearerAuth()
@Controller('workouts')
export class WorkoutScheduleController {
  constructor(private readonly schedule: WorkoutScheduleService) {}

  @Get('schedule')
  @ApiOperation({
    summary: 'Consultar os sete dias da agenda, de segunda a domingo',
  })
  list(@CurrentUserId() userId: string) {
    return this.schedule.list(userId);
  }

  @Get('today')
  @ApiOperation({
    summary: 'Consultar o treino de hoje no fuso informado',
    description:
      'Retorna workout null em dias sem treino. Não inicia uma sessão automaticamente.',
  })
  today(@CurrentUserId() userId: string, @Query() query: TodayWorkoutQueryDto) {
    return this.schedule.today(userId, query.timeZone);
  }

  @Put('schedule/:dayOfWeek')
  @ApiOperation({
    summary: 'Associar ou substituir o treino de um dia da semana',
    description:
      'Um treino por dia; o mesmo treino pode aparecer em vários dias. Dias ISO: segunda 1, domingo 7.',
  })
  assign(
    @CurrentUserId() userId: string,
    @Param() params: ScheduleDayDto,
    @Body() dto: AssignWorkoutDayDto,
  ) {
    return this.schedule.assign(userId, params.dayOfWeek, dto.workoutId);
  }

  @Delete('schedule/:dayOfWeek')
  @ApiOperation({
    summary: 'Remover o treino do dia, preservando o treino e o histórico',
  })
  remove(@CurrentUserId() userId: string, @Param() params: ScheduleDayDto) {
    return this.schedule.remove(userId, params.dayOfWeek);
  }
}
