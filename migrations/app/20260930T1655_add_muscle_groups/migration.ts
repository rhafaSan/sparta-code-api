#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2d78ab1c4c32e92d53902b6cab52348af0dc644c2b12350d1836d016064b2225/contract';
import startContract from '../../snapshots/2d78ab1c4c32e92d53902b6cab52348af0dc644c2b12350d1836d016064b2225/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/66b3dd2be95bc5ea572d8ea2d4477753255bb7901e12bfb67143326f0f353007/contract';
import endContract from '../../snapshots/66b3dd2be95bc5ea572d8ea2d4477753255bb7901e12bfb67143326f0f353007/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'exercise_muscles',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('exercise_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('muscle_group_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'muscle_groups',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('is_active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('view', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'exercise_muscles',
        constraint: 'exercise_muscles_exercise_id_muscle_group_id_key',
        columns: ['exercise_id', 'muscle_group_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'muscle_groups',
        constraint: 'muscle_groups_slug_key',
        columns: ['slug'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'exercise_muscles',
        index: 'exercise_muscles_exercise_id_idx_b01d81a7',
        columns: ['exercise_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'exercise_muscles',
        index: 'exercise_muscles_muscle_group_id_idx_317bd837',
        columns: ['muscle_group_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'exercise_muscles',
        foreignKey: {
          name: 'exercise_muscles_exercise_id_fkey',
          columns: ['exercise_id'],
          references: { schema: 'public', table: 'exercises', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'exercise_muscles',
        foreignKey: {
          name: 'exercise_muscles_muscle_group_id_fkey',
          columns: ['muscle_group_id'],
          references: { schema: 'public', table: 'muscle_groups', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
