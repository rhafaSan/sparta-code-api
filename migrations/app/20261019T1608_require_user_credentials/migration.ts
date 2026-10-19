#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2383242502a983fba63f8f0c63c61905a3bd9a3d15004f8942e27ae1cbb97fe5/contract';
import startContract from '../../snapshots/2383242502a983fba63f8f0c63c61905a3bd9a3d15004f8942e27ae1cbb97fe5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fd2f097cb1531d5bbbeaac10b8a03cb221836674231fb4199e5f18103a7177c3/contract';
import endContract from '../../snapshots/fd2f097cb1531d5bbbeaac10b8a03cb221836674231fb4199e5f18103a7177c3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      // Existing users must be assigned individual credentials before this
      // migration. Fail on NULL rather than inventing a shared default password.
      this.setNotNull({ schema: 'public', table: 'users', column: 'email' }),
      this.setNotNull({ schema: 'public', table: 'users', column: 'password_hash' }),
      this.setNotNull({ schema: 'public', table: 'users', column: 'username' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
