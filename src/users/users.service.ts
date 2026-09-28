import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/user.dto.js';
import { PageQueryDto } from '../common/dto/list-query.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateUserDto) {
    return this.prisma.db.orm.public.User.create({ name: dto.name.trim() });
  }

  async list(query: PageQueryDto) {
    return await this.prisma.db.orm.public.User.orderBy((u) =>
      u.createdAt.asc(),
    )
      .orderBy((u) => u.id.asc())
      .limit(query.limit)
      .offset(query.offset)
      .all();
  }

  async get(id: string) {
    const user = await this.prisma.db.orm.public.User.first({ id });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: CreateUserDto) {
    const user = await this.prisma.db.orm.public.User.where({ id }).update({
      name: dto.name.trim(),
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
