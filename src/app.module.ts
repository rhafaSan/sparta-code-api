import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { ExercisesModule } from './exercises/exercises.module.js';
import { WorkoutsModule } from './workouts/workouts.module.js';
import { WorkoutSessionsModule } from './workout-sessions/workout-sessions.module.js';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { DatabaseExceptionFilter } from './common/database-exception.filter.js';
import { createValidationPipe } from './common/validation.js';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    ExercisesModule,
    WorkoutsModule,
    WorkoutSessionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: DatabaseExceptionFilter },
  ],
})
export class AppModule {}
