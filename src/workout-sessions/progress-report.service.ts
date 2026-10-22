import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressReportQueryDto } from './dto/progress-report.dto.js';
import { buildProgressReport, reportRange } from './progress-report.js';

@Injectable()
export class ProgressReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(userId: string, query: ProgressReportQueryDto) {
    const { start, end } = reportRange(query);
    if (
      query.workoutId &&
      !(await this.prisma.db.orm.public.Workout.where({
        id: query.workoutId,
        userId,
      }).first())
    )
      throw new NotFoundException('Workout not found');
    if (
      query.exerciseId &&
      !(await this.prisma.db.orm.public.Exercise.first({
        id: query.exerciseId,
      }))
    )
      throw new NotFoundException('Exercise not found');

    let sessions = this.prisma.db.orm.public.WorkoutSession.where({ userId })
      .where((session) => session.finishedAt.isNotNull())
      .where((session) => session.startedAt.gte(start))
      .where((session) => session.startedAt.lt(end));
    if (query.workoutId)
      sessions = sessions.where({ workoutId: query.workoutId });
    const exerciseId = query.exerciseId;
    const history = await sessions
      .include('exerciseSessions', (executions) => {
        const filtered = exerciseId
          ? executions.where((execution) =>
              execution.workoutExercise.some({ exerciseId }),
            )
          : executions;
        return filtered
          .include('workoutExercise', (entry) => entry.include('exercise'))
          .include('sets', (sets) => sets.where({ completed: true }));
      })
      .all();

    return buildProgressReport(
      userId,
      query,
      history.flatMap((session) =>
        session.exerciseSessions.flatMap((execution) => {
          const exercise = execution.workoutExercise?.exercise;
          return exercise
            ? [
                {
                  workoutSessionId: session.id,
                  startedAt: session.startedAt,
                  exerciseId: exercise.id,
                  exerciseName: exercise.name,
                  sets: execution.sets,
                },
              ]
            : [];
        }),
      ),
    );
  }
}
