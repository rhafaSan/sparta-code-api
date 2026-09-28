import 'dotenv/config';
import 'temporal-polyfill/global';
import 'temporal-polyfill/types/global';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d.js';
import contractJson from './contract.json' with { type: 'json' };

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL'],
  poolOptions: { connectionTimeoutMillis: 10_000 },
});

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
