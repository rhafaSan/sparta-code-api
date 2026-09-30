#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2d78ab1c4c32e92d53902b6cab52348af0dc644c2b12350d1836d016064b2225/contract';
import endContract from '../../snapshots/2d78ab1c4c32e92d53902b6cab52348af0dc644c2b12350d1836d016064b2225/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'exercise_sessions',
        columns: [
          col('completed', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('exercise_order', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('planned_reps', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('planned_sets', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('rest_seconds', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('workout_exercise_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('workout_session_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'exercise_sets',
        columns: [
          col('completed', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('exercise_session_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('reps', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('set_number', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('weight', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'exercises',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('is_active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('muscle_group', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'users',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'workout_exercises',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('exercise_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('exercise_order', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('is_active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('planned_reps', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('planned_sets', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('rest_seconds', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('workout_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'workout_sessions',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('finished_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('started_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('workout_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'workouts',
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
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'exercise_sessions',
        constraint: 'exercise_sessions_workout_session_id_workout_exercise_id_key',
        columns: ['workout_session_id', 'workout_exercise_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'exercise_sets',
        constraint: 'exercise_sets_exercise_session_id_set_number_key',
        columns: ['exercise_session_id', 'set_number'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'workout_exercises',
        constraint: 'workout_exercises_workout_id_exercise_order_key',
        columns: ['workout_id', 'exercise_order'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'exercise_sessions',
        index: 'exercise_sessions_workout_exercise_id_idx_e8bd1b8c',
        columns: ['workout_exercise_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'exercise_sessions',
        index: 'exercise_sessions_workout_session_id_idx_4025b05c',
        columns: ['workout_session_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'exercise_sets',
        index: 'exercise_sets_exercise_session_id_idx_f8a0614a',
        columns: ['exercise_session_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'exercises',
        index: 'exercises_name_idx_ce87e6ba',
        columns: ['name'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workout_exercises',
        index: 'workout_exercises_exercise_id_idx_b01d81a7',
        columns: ['exercise_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workout_exercises',
        index: 'workout_exercises_workout_id_idx_7b5dce6d',
        columns: ['workout_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workout_exercises',
        index: 'workout_exercises_workout_id_is_active_idx_00f9ff08',
        columns: ['workout_id', 'is_active'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workout_sessions',
        index: 'workout_sessions_started_at_idx_bcc4bc60',
        columns: ['started_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workout_sessions',
        index: 'workout_sessions_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workout_sessions',
        index: 'workout_sessions_user_id_started_at_idx_beb66913',
        columns: ['user_id', 'started_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workout_sessions',
        index: 'workout_sessions_workout_id_idx_7b5dce6d',
        columns: ['workout_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workouts',
        index: 'workouts_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workouts',
        index: 'workouts_user_id_is_active_idx_cacd3433',
        columns: ['user_id', 'is_active'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'exercise_sessions',
        foreignKey: {
          name: 'exercise_sessions_workout_session_id_fkey',
          columns: ['workout_session_id'],
          references: { schema: 'public', table: 'workout_sessions', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'exercise_sessions',
        foreignKey: {
          name: 'exercise_sessions_workout_exercise_id_fkey',
          columns: ['workout_exercise_id'],
          references: { schema: 'public', table: 'workout_exercises', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'exercise_sets',
        foreignKey: {
          name: 'exercise_sets_exercise_session_id_fkey',
          columns: ['exercise_session_id'],
          references: { schema: 'public', table: 'exercise_sessions', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'workout_exercises',
        foreignKey: {
          name: 'workout_exercises_workout_id_fkey',
          columns: ['workout_id'],
          references: { schema: 'public', table: 'workouts', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'workout_exercises',
        foreignKey: {
          name: 'workout_exercises_exercise_id_fkey',
          columns: ['exercise_id'],
          references: { schema: 'public', table: 'exercises', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'workout_sessions',
        foreignKey: {
          name: 'workout_sessions_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'workout_sessions',
        foreignKey: {
          name: 'workout_sessions_workout_id_fkey',
          columns: ['workout_id'],
          references: { schema: 'public', table: 'workouts', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'workouts',
        foreignKey: {
          name: 'workouts_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
