import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { eq, isNull } from 'drizzle-orm';
import type { LLMPort } from '../../domain/ports/llm.port';
import {
  accountTable,
  categoryTable,
  healthCheckTable,
  transactionTable,
  userTable,
} from '../../infrastructure/database/drizzle/schema';
import type { DemoUserIds } from './cognito-bootstrap';

const SEED_NAME = 'seed:initial';
const ACCOUNT_ID = '20000000-0000-4000-8000-000000000001';

const CATEGORY_SEEDS = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    slug: 'alimentos',
    name: 'Alimentos',
    color: '#F59E0B',
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    slug: 'transporte',
    name: 'Transporte',
    color: '#3B82F6',
  },
  {
    id: '40000000-0000-4000-8000-000000000003',
    slug: 'entretenimiento',
    name: 'Entretenimiento',
    color: '#8B5CF6',
  },
  {
    id: '40000000-0000-4000-8000-000000000004',
    slug: 'servicios',
    name: 'Servicios',
    color: '#10B981',
  },
  {
    id: '40000000-0000-4000-8000-000000000005',
    slug: 'compras',
    name: 'Compras',
    color: '#EC4899',
  },
  {
    id: '40000000-0000-4000-8000-000000000006',
    slug: 'salud',
    name: 'Salud',
    color: '#EF4444',
  },
  {
    id: '40000000-0000-4000-8000-000000000007',
    slug: 'educacion',
    name: 'Educación',
    color: '#06B6D4',
  },
  {
    id: '40000000-0000-4000-8000-000000000008',
    slug: 'otros',
    name: 'Otros',
    color: '#64748B',
  },
] as const;

const TRANSACTION_TEMPLATES = [
  { merchant: 'Café Martínez', amount: 850000, category: 'alimentos' },
  { merchant: 'Carrefour', amount: 3275000, category: 'alimentos' },
  { merchant: 'Shell', amount: 4200000, category: 'transporte' },
  { merchant: 'SUBE', amount: 85000, category: 'transporte' },
  { merchant: 'Spotify AR', amount: 349900, category: 'entretenimiento' },
  { merchant: 'Cinemark Hoyts', amount: 1250000, category: 'entretenimiento' },
  { merchant: 'Edesur', amount: 2850000, category: 'servicios' },
  { merchant: 'Personal Flow', amount: 1980000, category: 'servicios' },
  { merchant: 'Mercado Libre', amount: 8650000, category: 'compras' },
  { merchant: 'Farmacity', amount: 1750000, category: 'salud' },
  { merchant: 'OSDE Copago', amount: 2400000, category: 'salud' },
  { merchant: 'Coderhouse', amount: 15200000, category: 'educacion' },
  { merchant: 'Librería Cúspide', amount: 2890000, category: 'educacion' },
  { merchant: 'PedidosYa', amount: 1850000, category: 'alimentos' },
  { merchant: 'YPF', amount: 3850000, category: 'transporte' },
  { merchant: 'Netflix', amount: 599900, category: 'entretenimiento' },
  { merchant: 'AySA', amount: 920000, category: 'servicios' },
  { merchant: 'Zara', amount: 24500000, category: 'compras' },
  { merchant: 'Megatlon', amount: 6900000, category: 'salud' },
  { merchant: 'Kiosco 24hs', amount: 450000, category: 'otros' },
] as const;

export interface SeedResult {
  readonly inserted: number;
  readonly healthChecks: number;
  readonly users: number;
  readonly categories: number;
  readonly accounts: number;
  readonly transactions: number;
  readonly categoryEmbeddings: number;
}

export async function runSeed(
  db: NeonHttpDatabase,
  demoUsers: DemoUserIds,
  llm: LLMPort,
): Promise<SeedResult> {
  const existingHealth = await db
    .select({ id: healthCheckTable.id })
    .from(healthCheckTable)
    .where(eq(healthCheckTable.name, SEED_NAME))
    .limit(1);
  const healthRows =
    existingHealth.length > 0
      ? []
      : await db
          .insert(healthCheckTable)
          .values({ name: SEED_NAME })
          .returning({ id: healthCheckTable.id });

  const userRows = await db
    .insert(userTable)
    .values([
      {
        id: demoUsers.adminUserId,
        email: 'admin@portfolio.dev',
        name: 'Admin Demo',
        tier: 'GOLD',
      },
      {
        id: demoUsers.regularUserId,
        email: 'user@portfolio.dev',
        name: 'Usuario Demo',
        tier: 'BRONZE',
      },
    ])
    .onConflictDoNothing()
    .returning({ id: userTable.id });

  const categoryRows = await db
    .insert(categoryTable)
    .values(CATEGORY_SEEDS.map((category) => ({ ...category })))
    .onConflictDoNothing()
    .returning({ id: categoryTable.id });

  const accountRows = await db
    .insert(accountTable)
    .values({
      id: ACCOUNT_ID,
      userId: demoUsers.regularUserId,
      name: 'Banco Demo',
      type: 'BANK',
    })
    .onConflictDoNothing()
    .returning({ id: accountTable.id });

  const categoryIds = new Map(
    CATEGORY_SEEDS.map((category) => [category.slug, category.id]),
  );
  const transactionRows = await db
    .insert(transactionTable)
    .values(
      Array.from({ length: 50 }, (_, index) => {
        const template = TRANSACTION_TEMPLATES[index % TRANSACTION_TEMPLATES.length]!;
        return {
          id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          userId: demoUsers.regularUserId,
          accountId: ACCOUNT_ID,
          categoryId: categoryIds.get(template.category)!,
          merchant: template.merchant,
          amount: template.amount + Math.floor(index / TRANSACTION_TEMPLATES.length) * 12500,
          occurredAt: new Date(Date.UTC(2026, 6, 28 - index, 12)),
          status: 'CATEGORIZED' as const,
          notes: index % 7 === 0 ? 'Gasto de demostración' : null,
        };
      }),
    )
    .onConflictDoNothing()
    .returning({ id: transactionTable.id });

  const categoryEmbeddings = await backfillCategoryEmbeddings(db, llm);

  const counts = {
    healthChecks: healthRows.length,
    users: userRows.length,
    categories: categoryRows.length,
    accounts: accountRows.length,
    transactions: transactionRows.length,
    categoryEmbeddings,
  };
  const inserted = Object.values({
    healthChecks: healthRows.length,
    users: userRows.length,
    categories: categoryRows.length,
    accounts: accountRows.length,
    transactions: transactionRows.length,
  }).reduce((total, count) => total + count, 0);
  console.log('[seed] Idempotent seed complete:', { inserted, ...counts });
  return { inserted, ...counts };
}

async function backfillCategoryEmbeddings(
  db: NeonHttpDatabase,
  llm: LLMPort,
): Promise<number> {
  const pending = await db
    .select({ id: categoryTable.id, slug: categoryTable.slug, name: categoryTable.name })
    .from(categoryTable)
    .where(isNull(categoryTable.embedding));

  if (pending.length === 0) {
    console.log('[seed] All category embeddings already populated.');
    return 0;
  }

  let succeeded = 0;
  for (const category of pending) {
    try {
      const embedding = await llm.embed(`${category.name} ${category.slug}`);
      await db
        .update(categoryTable)
        .set({ embedding })
        .where(eq(categoryTable.id, category.id));
      succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[seed] Could not compute embedding for "${category.slug}" (will retry next deploy): ${message.slice(0, 200)}`,
      );
      // Continue with other categories — embedding failure must NOT block the seed
    }
  }

  console.log(`[seed] Category embeddings: ${succeeded}/${pending.length} computed`);
  return succeeded;
}
