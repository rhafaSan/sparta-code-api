import { Module } from '@nestjs/common';
import { WorkoutsService } from './workouts.service.js';
import { WorkoutsController } from './workouts.controller.js';
import { WorkoutGenerationController } from './generation/workout-generation.controller.js';
import { WorkoutGenerationService } from './generation/workout-generation.service.js';
import { GeminiWorkoutProvider } from './generation/gemini-workout.provider.js';
@Module({
  providers: [WorkoutsService, WorkoutGenerationService, GeminiWorkoutProvider],
  controllers: [WorkoutGenerationController, WorkoutsController],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
