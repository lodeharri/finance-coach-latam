import { CategorizeTransactionUseCase } from '../../application/use-cases/categorize-transaction.use-case';
import type { Actor } from '../../application/use-cases/authorization';
import { getConfig } from '../../infrastructure/config/env.config';
import { transactionTableRef } from '../../infrastructure/database/drizzle/schema';
import { NeonDatabaseAdapter } from '../../infrastructure/database/neon-database.adapter';
import { createLLMProvider } from '../../infrastructure/llm/llm.factory';
import { buildCategorizerHandler } from './handler';

export function buildComposition() {
  const config = getConfig();
  const database = new NeonDatabaseAdapter(config.databaseUrl);
  const llm = createLLMProvider(config.llm);

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