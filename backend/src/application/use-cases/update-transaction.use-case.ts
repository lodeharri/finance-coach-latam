import type { Transaction } from '../../domain/entities/transaction.entity';
import type { Category } from '../../domain/entities/category.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import type { MerchantCachePort } from '../../domain/ports/merchant-cache.port';
import { assertCanActAs, type Actor } from './authorization';

export interface UpdateTransactionCategoryInput {
  readonly actor: Actor;
  readonly transactionId: string;
  readonly categoryId: string;
  /**
   * Optional spoofable target userId. The use case IGNORES this for authz
   * (REQ-FFC-AUTH-TX-OWNER): we always load by id only and compare the
   * actor against the row's real userId. Keeping the field on the input
   * shape means the route layer can forward the candidate without a
   * separate signature, but the contract is "the row decides who you
   * must be", not "you decide who the row belongs to".
   */
  readonly userId?: string;
}

/**
 * REQ-FFC-BE-PATCH-TRANSACTION: manually override the category on a single
 * transaction. Loads by id first, asserts the actor is owner or admin against
 * the row's real userId (NEVER against a spoofed candidate), then verifies
 * the new category exists, updates the row, and writes the merchant cache
 * best-effort so subsequent transactions for the same merchant short-circuit.
 */
export class UpdateTransactionCategoryUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly transactionTableRef: TableRef<Transaction>,
    private readonly categoriesTableRef: TableRef<Category>,
    private readonly merchantCachePort: MerchantCachePort,
  ) {}

  async execute(
    input: UpdateTransactionCategoryInput,
  ): Promise<Transaction> {
    // REQ-FFC-AUTH-TX-OWNER: load by id only, then assert. The actor's role
    // and id determine whether they may touch the row. A spoofed userId on
    // the input does NOT bypass this check.
    const [transaction] = await this.database.select(this.transactionTableRef, {
      where: { id: input.transactionId },
      limit: 1,
    });
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    assertCanActAs(input.actor, transaction.userId);

    const categories = await this.database.select(this.categoriesTableRef, {
      where: { id: input.categoryId },
      limit: 1,
    });
    if (categories.length === 0) {
      throw new Error('Category not found');
    }

    const updated = await this.database.update(
      this.transactionTableRef,
      { id: transaction.id, userId: transaction.userId },
      { categoryId: input.categoryId },
    );

    // REQ-FFC-BE-PATCH-AUDIT: best-effort cache write so subsequent
    // transactions for the same merchant short-circuit the LLM path.
    // Cache failure must NOT fail the override — the canonical record
    // is the transactions table.
    const normalized = transaction.merchant.trim().replace(/\s+/g, ' ').toLowerCase();
    try {
      await this.merchantCachePort.save(normalized, input.categoryId);
    } catch (err) {
      console.warn('merchant cache write failed', { merchant: normalized, err });
    }

    return updated;
  }
}