#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b56cc1d1863a5e67d52e9c4d4723cd98fa898cc36af47df748546df976d9ebb7/contract';
import endContract from '../../snapshots/b56cc1d1863a5e67d52e9c4d4723cd98fa898cc36af47df748546df976d9ebb7/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fd2f097cb1531d5bbbeaac10b8a03cb221836674231fb4199e5f18103a7177c3/contract';
import startContract from '../../snapshots/fd2f097cb1531d5bbbeaac10b8a03cb221836674231fb4199e5f18103a7177c3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'exercise_sets',
        column: col('set_type', 'text', {
          notNull: true,
          default: lit('working'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
