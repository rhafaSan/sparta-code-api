import {
  Injectable,
  type OnModuleInit,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { db } from './db.js';

@Injectable()
export class PrismaService implements OnModuleInit, OnApplicationShutdown {
  readonly db = db;

  async onModuleInit() {
    if (!process.env.DATABASE_URL)
      throw new Error('DATABASE_URL must be configured');
    await this.db.orm.public.User.limit(1).all();
  }

  async onApplicationShutdown() {
    await this.db.close();
  }
}
