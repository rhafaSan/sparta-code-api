import { Module } from '@nestjs/common';
import { WorkoutsModule } from '../workouts/workouts.module.js';
import { WorkoutSessionsController } from './workout-sessions.controller.js';
import { WorkoutSessionsService } from './workout-sessions.service.js';
import { ProgressReportService } from './progress-report.service.js';
@Module({
  imports: [WorkoutsModule],
  controllers: [WorkoutSessionsController],
  providers: [WorkoutSessionsService, ProgressReportService],
})
export class WorkoutSessionsModule {}
