#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4cb1755b5972b5fe5608e8f617752c18765e255ce94b42da5be0cc2bc03a0dce/contract';
import endContract from '../../snapshots/4cb1755b5972b5fe5608e8f617752c18765e255ce94b42da5be0cc2bc03a0dce/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b56cc1d1863a5e67d52e9c4d4723cd98fa898cc36af47df748546df976d9ebb7/contract';
import startContract from '../../snapshots/b56cc1d1863a5e67d52e9c4d4723cd98fa898cc36af47df748546df976d9ebb7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'workout_schedules',
        columns: [
          col('day_of_week', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('workout_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'workout_schedules',
        constraint: 'workout_schedules_user_id_day_of_week_key',
        columns: ['user_id', 'day_of_week'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workout_schedules',
        index: 'workout_schedules_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workout_schedules',
        index: 'workout_schedules_workout_id_idx_7b5dce6d',
        columns: ['workout_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'workout_schedules',
        foreignKey: {
          name: 'workout_schedules_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'workout_schedules',
        foreignKey: {
          name: 'workout_schedules_workout_id_fkey',
          columns: ['workout_id'],
          references: { schema: 'public', table: 'workouts', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
