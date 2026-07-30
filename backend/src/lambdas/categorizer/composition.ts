import { CategorizeTransactionUseCase } from '../../application/use-cases/categorize-transaction.use-case';
import type { Actor } from '../../application/use-cases/authorization';
import { getConfig } from '../../infrastructure/config/env.config';
import { transactionTableRef } from '../../infrastructure/database/drizzle/schema';
import { MerchantCacheAdapter } from '../../infrastructure/database/merchant-cache.adapter';
import { NeonDatabaseAdapter } from '../../infrastructure/database/neon-database.adapter';
import { createLLMProvider } from '../../infrastructure/llm/llm.factory';
import { buildCategorizerHandler } from './handler';

export function buildComposition() {
  const config = getConfig();
  const database = new NeonDatabaseAdapter(config.databaseUrl);
  const llm = createLLMProvider(config.llm);
  // Slice 3 will pass this into CategorizeTransactionUseCase. Instantiated now
  // so the wiring change in Slice 3 stays a one-line use-case constructor edit.
  const merchantCache = new MerchantCacheAdapter(database);
  void merchantCache;

  const categorizeTransactionUseCase = new CategorizeTransactionUseCase(
    database,
    llm,
    transactionTableRef,
  );

  return buildCategorizerHandler({
    categorizeTransactionUseCase,
    actor: { userId: 'system', role: 'admin' } satisfies Actor,
  });
}

export const handler = buildComposition();