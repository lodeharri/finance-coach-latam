import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { getConfig } from '../../infrastructure/config/env.config';
import { buildMigrationHandler } from './handler';

export function buildComposition() {
  const config = getConfig();
  const sql = neon(config.databaseUrl);
  const db: NeonHttpDatabase = drizzle(sql);
  const migrationsFolder = resolve(__dirname, 'drizzle');
  return buildMigrationHandler({ db, migrationsFolder });
}

export const handler = buildComposition();
