import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto.js';
import { hashPassword } from '../auth/password.js';
import { PageQueryDto } from '../common/dto/list-query.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const passwordHash = await hashPassword(dto.password);
    return this.prisma.db.orm.public.User.select(
      'id',
      'name',
      'email',
      'username',
      'createdAt',
    ).create({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      username: dto.username.trim().toLowerCase(),
      passwordHash,
    });
  }

  async list(query: PageQueryDto, userId: string) {
    return await this.prisma.db.orm.public.User.where({ id: userId })
      .select('id', 'name', 'email', 'username', 'createdAt')
      .orderBy((u) => u.createdAt.asc())
      .orderBy((u) => u.id.asc())
      .limit(query.limit)
      .offset(query.offset)
      .all();
  }

  async get(id: string) {
    const user = await this.prisma.db.orm.public.User.select(
      'id',
      'name',
      'email',
      'username',
      'createdAt',
    ).first({ id });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.db.orm.public.User.where({ id })
      .select('id', 'name', 'email', 'username', 'createdAt')
      .update({
        name: dto.name.trim(),
      });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
