import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { healthCheckTable } from '../../infrastructure/database/drizzle/schema';

const SEED_NAME = 'seed:initial';

export async function runSeed(db: NeonHttpDatabase): Promise<{ inserted: number }> {
  console.log(`[seed] Ensuring idempotent seed row name="${SEED_NAME}"`);

  const existing = await db
    .select({ id: healthCheckTable.id })
    .from(healthCheckTable)
    .where(eq(healthCheckTable.name, SEED_NAME))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[seed] Row already present (id=${existing[0]?.id}); no-op (idempotent).`);
    return { inserted: 0 };
  }

  const inserted = await db
    .insert(healthCheckTable)
    .values({ name: SEED_NAME })
    .returning({ id: healthCheckTable.id });

  const count = inserted.length;
  console.log(`[seed] Inserted ${count} row(s).`);
  return { inserted: count };
}
