#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2383242502a983fba63f8f0c63c61905a3bd9a3d15004f8942e27ae1cbb97fe5/contract';
import endContract from '../../snapshots/2383242502a983fba63f8f0c63c61905a3bd9a3d15004f8942e27ae1cbb97fe5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/66b3dd2be95bc5ea572d8ea2d4477753255bb7901e12bfb67143326f0f353007/contract';
import startContract from '../../snapshots/66b3dd2be95bc5ea572d8ea2d4477753255bb7901e12bfb67143326f0f353007/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'auth_sessions',
        columns: [
          col('access_expires_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('access_token_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expires_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idle_expires_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('revoked_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'refresh_tokens',
        columns: [
          col('auth_session_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('consumed_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('token_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('password_hash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('username', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'auth_sessions',
        constraint: 'auth_sessions_access_token_hash_key',
        columns: ['access_token_hash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'refresh_tokens',
        constraint: 'refresh_tokens_token_hash_key',
        columns: ['token_hash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'users_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'users_username_key',
        columns: ['username'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auth_sessions',
        index: 'auth_sessions_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'refresh_tokens',
        index: 'refresh_tokens_auth_session_id_idx_0d0ffbde',
        columns: ['auth_session_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'auth_sessions',
        foreignKey: {
          name: 'auth_sessions_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'refresh_tokens',
        foreignKey: {
          name: 'refresh_tokens_auth_session_id_fkey',
          columns: ['auth_session_id'],
          references: { schema: 'public', table: 'auth_sessions', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
