import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExerciseQueryDto } from './dto/exercise-query.dto.js';
import { catalogExerciseIds } from './exercise-catalog.js';
import { CreateExerciseDto, UpdateExerciseDto } from './dto/exercise.dto.js';

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}
  create(dto: CreateExerciseDto) {
    return this.prisma.db.orm.public.Exercise.create({
      ...dto,
      name: dto.name.trim(),
    });
  }
  async list(query: ExerciseQueryDto) {
    let exercises = this.prisma.db.orm.public.Exercise;
    if (!query.includeArchived) exercises = exercises.where({ isActive: true });
    // Treat SQL LIKE wildcards as literal characters in user input.
    const escapeLike = (value: string) =>
      value.trim().replace(/[\\%_]/g, '\\$&');
    const { q, muscleGroup } = query;
    if (q)
      exercises = exercises.where((e) => e.name.ilike(`%${escapeLike(q)}%`));
    if (muscleGroup)
      exercises = exercises.where((e) =>
        e.muscleGroup.ilike(escapeLike(muscleGroup)),
      );
    if (query.catalogOnly)
      exercises = exercises.where((e) => e.id.in(catalogExerciseIds));
    return await exercises
      .orderBy((e) => e.name.asc())
      .orderBy((e) => e.id.asc())
      .limit(query.limit)
      .offset(query.offset)
      .all();
  }
  async get(id: string) {
    const exercise = await this.prisma.db.orm.public.Exercise.first({ id });
    if (!exercise) throw new NotFoundException('Exercise not found');
    return exercise;
  }
  async update(id: string, dto: UpdateExerciseDto) {
    if (!Object.keys(dto).length) return this.get(id);
    const exercise = await this.prisma.db.orm.public.Exercise.where({
      id,
    }).update({
      ...dto,
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
    });
    if (!exercise) throw new NotFoundException('Exercise not found');
    return exercise;
  }
}
