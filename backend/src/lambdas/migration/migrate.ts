import { migrate } from 'drizzle-orm/neon-http/migrator';
import type { MigrationConfig } from 'drizzle-orm/migrator';
import { sql as drizzleSql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type MigrationsFolder = string | MigrationConfig;

export async function runMigrations(
  db: NeonHttpDatabase,
  migrationsFolder: MigrationsFolder,
): Promise<number> {
  const folder = typeof migrationsFolder === 'string' ? migrationsFolder : migrationsFolder.migrationsFolder;
  console.log(`[migrate] Applying Drizzle migrations from folder: ${folder}`);

  let before = 0;
  try {
    before = await countMigrations(db);
    console.log(`[migrate] Migrations table found. Existing count: ${before}.`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[migrate] No prior migrations table (will be created). Reason: ${msg.slice(0, 120)}`);
  }

  await migrate(db, { migrationsFolder: folder });

  const after = await countMigrations(db);
  const applied = after - before;

  if (applied > 0) {
    console.log(`[migrate] Applied ${applied} migration(s). Total applied: ${after}.`);
  } else {
    console.log(`[migrate] Already up to date. Total applied: ${after}.`);
  }

  return applied;
}

async function countMigrations(db: NeonHttpDatabase): Promise<number> {
  const result = await db.execute(
    drizzleSql<{ count: number }>`SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations`,
  );
  const rows = (result as unknown as { rows?: Array<{ count: number }> }).rows ?? [];
  const first = rows[0];
  return first?.count ?? 0;
}
