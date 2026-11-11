import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const weekDays = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
] as const;

export function localWorkoutDay(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)!.value;
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    dayOfWeek:
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(
        part('weekday'),
      ) + 1,
  };
}

@Injectable()
export class WorkoutScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const entries = await this.prisma.db.orm.public.WorkoutSchedule.where({
      userId,
    })
      .include('workout')
      .orderBy((entry) => entry.dayOfWeek.asc())
      .all();
    return weekDays.map((dayName, index) => {
      const workout = entries.find(
        (entry) => entry.dayOfWeek === index + 1,
      )?.workout;
      const active = workout?.isActive ? workout : null;
      return {
        dayOfWeek: index + 1,
        dayName,
        workoutId: active?.id ?? null,
        workout: active,
      };
    });
  }

  async today(userId: string, timeZone: string) {
    const { date, dayOfWeek } = localWorkoutDay(new Date(), timeZone);
    const entry = await this.prisma.db.orm.public.WorkoutSchedule.where({
      userId,
      dayOfWeek,
    })
      .include('workout', (workout) =>
        workout.include('workoutExercises', (exercises) =>
          exercises
            .where({ isActive: true })
            .orderBy((exercise) => exercise.exerciseOrder.asc())
            .include('exercise'),
        ),
      )
      .first();
    const workout = entry?.workout?.isActive ? entry.workout : null;
    return {
      date,
      timeZone,
      dayOfWeek,
      dayName: weekDays[dayOfWeek - 1],
      workoutId: workout?.id ?? null,
      workout,
    };
  }

  assign(userId: string, dayOfWeek: number, workoutId: string) {
    return this.prisma.db.transaction(async (tx) => {
      // Lock the workout first, matching session-start lock order. Lock before
      // checking active state so concurrent archival cannot leave a stale assignment.
      const workout = await tx.orm.public.Workout.where({
        id: workoutId,
        userId,
      }).update({ id: workoutId });
      if (!workout) throw new NotFoundException('Workout not found');
      if (!workout.isActive) throw new ConflictException('Workout is archived');
      // Serialize schedule changes for this owner, including empty days.
      if (
        !(await tx.orm.public.User.where({ id: userId }).update({ id: userId }))
      )
        throw new NotFoundException('User not found');
      const entry = await tx.orm.public.WorkoutSchedule.where({
        userId,
        dayOfWeek,
      }).first();
      return entry
        ? tx.orm.public.WorkoutSchedule.where({ id: entry.id }).update({
            workoutId,
          })
        : tx.orm.public.WorkoutSchedule.create({
            userId,
            dayOfWeek,
            workoutId,
          });
    });
  }

  remove(userId: string, dayOfWeek: number) {
    return this.prisma.db.transaction(async (tx) => {
      if (
        !(await tx.orm.public.User.where({ id: userId }).update({ id: userId }))
      )
        throw new NotFoundException('User not found');
      await tx.orm.public.WorkoutSchedule.where({
        userId,
        dayOfWeek,
      }).deleteAll();
      return { dayOfWeek, workoutId: null };
    });
  }
}
