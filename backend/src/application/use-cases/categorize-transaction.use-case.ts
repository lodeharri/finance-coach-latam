import type { Transaction } from '../../domain/entities/transaction.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import type { LLMPort } from '../../domain/ports/llm.port';
import { assertCanActAs, type Actor } from './authorization';

export interface CategorizeTransactionInput {
  readonly actor: Actor;
  readonly transactionId: string;
  readonly userId: string;
}

interface RankedCategoryRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly distance: number;
}

const SIMILAR_SQL =
  "SELECT id, slug, name, embedding <=> $1::vector AS distance " +
  'FROM categories ' +
  'WHERE embedding IS NOT NULL ' +
  'ORDER BY distance ASC ' +
  'LIMIT 5';

export class CategorizeTransactionUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly llm: LLMPort,
    private readonly transactionTableRef: TableRef<Transaction>,
  ) {}

  async execute(input: CategorizeTransactionInput): Promise<Transaction> {
    assertCanActAs(input.actor, input.userId);

    const [transaction] = await this.database.select(this.transactionTableRef, {
      where: { id: input.transactionId, userId: input.userId },
      limit: 1,
    });
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const transactionText = [transaction.merchant, transaction.notes]
      .filter(Boolean)
      .join(' ');
    const transactionEmbedding = await this.llm.embed(transactionText);

    const ranked = await this.queryRankedCategories(transactionEmbedding);
    if (ranked.length === 0) {
      throw new Error('No categories are available');
    }

    const prompt = [
      'Choose the single best category for this financial transaction.',
      `Merchant: ${transaction.merchant}`,
      `Amount in cents: ${transaction.amount}`,
      `Notes: ${transaction.notes ?? ''}`,
      'Categories ordered by semantic similarity:',
      ...ranked.map(({ id, name, slug }) => `${id} | ${name} | ${slug}`),
      'Return only the category UUID.',
    ].join('\n');
    const suggestion = await this.llm.generateText(prompt);
    const selected = ranked.find((category) => suggestion.includes(category.id));
    if (!selected) {
      throw new Error('LLM returned an unknown category');
    }

    return this.database.update(
      this.transactionTableRef,
      { id: transaction.id, userId: input.userId },
      { categoryId: selected.id, status: 'CATEGORIZED' },
    );
  }

  private async queryRankedCategories(
    embedding: readonly number[],
  ): Promise<RankedCategoryRow[]> {
    if (!this.database.query) {
      throw new Error('CategorizeTransactionUseCase: database adapter does not support raw queries');
    }
    return this.database.query<RankedCategoryRow>(SIMILAR_SQL, [
      JSON.stringify(embedding),
    ]);
  }
}