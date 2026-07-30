import type { Transaction } from '../../domain/entities/transaction.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import type { LLMPort } from '../../domain/ports/llm.port';
import type { MerchantCachePort } from '../../domain/ports/merchant-cache.port';
import { KEYWORDS, matchKeyword } from '../../domain/keywords/category-keywords';
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

interface CategoryRow {
  readonly id: string;
  readonly slug: string;
}

const SIMILAR_SQL =
  "SELECT id, slug, name, embedding <=> $1::vector AS distance " +
  'FROM categories ' +
  'WHERE embedding IS NOT NULL ' +
  'ORDER BY distance ASC ' +
  'LIMIT 5';

const CATEGORY_BY_SLUG_SQL =
  'SELECT id, slug FROM categories WHERE slug = $1 LIMIT 1';

// Req-TC-004: a top-1 distance below this fraction of the top-2 wins auto-accept.
const AUTO_ACCEPT_THRESHOLD = 0.5;

export class CategorizeTransactionUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly llm: LLMPort,
    private readonly transactionTableRef: TableRef<Transaction>,
    private readonly merchantCachePort: MerchantCachePort,
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

    const normalized = this.normalize(transaction.merchant);

    // ── KEYWORD LAYER (REQ-TC-001) ─────────────────────────────────────────
    const keywordSlug = matchKeyword(normalized);
    if (keywordSlug) {
      const keywordCategoryId = await this.resolveCategoryIdBySlug(keywordSlug);
      if (keywordCategoryId) {
        const updated = await this.database.update(
          this.transactionTableRef,
          { id: transaction.id, userId: input.userId },
          { categoryId: keywordCategoryId, status: 'CATEGORIZED' },
        );
        await this.writeCacheBestEffort(normalized, keywordCategoryId);
        return updated;
      }
      // If the slug is in KEYWORDS but the seed row is missing (corruption),
      // fall through to the cache layer rather than fail. The spec expects
      // the keyword layer to be additive; never the only path.
    }

    // ── CACHE LAYER (REQ-TC-002) ───────────────────────────────────────────
    const cached = await this.merchantCachePort.findByMerchant(normalized);
    if (cached) {
      return this.database.update(
        this.transactionTableRef,
        { id: transaction.id, userId: input.userId },
        { categoryId: cached.categoryId, status: 'CATEGORIZED' },
      );
    }

    // ── EMBEDDING LAYER (REQ-TC-003) ───────────────────────────────────────
    // The catch covers the embed call only. The similarity query stays outside
    // because the spec (REQ-TC-003 second scenario) says zero rows throws
    // 'No categories are available', while embed failure (REQ-TC-007) writes
    // PENDING and returns silently.
    const transactionText = [transaction.merchant, transaction.notes]
      .filter(Boolean)
      .join(' ');
    let vector: readonly number[];
    try {
      vector = await this.llm.embed(transactionText);
    } catch (embedErr) {
      console.warn('categorize transaction embed failed', {
        transactionId: transaction.id,
        err: embedErr,
      });
      return this.database.update(
        this.transactionTableRef,
        { id: transaction.id, userId: input.userId },
        { status: 'PENDING' },
      );
    }

    const ranked = await this.queryRankedCategories(vector);
    if (ranked.length === 0) {
      throw new Error('No categories are available');
    }

    // ── AUTO-ACCEPT THRESHOLD (REQ-TC-004) ─────────────────────────────────
    if (
      ranked.length === 1 ||
      ranked[0]!.distance < ranked[1]!.distance * AUTO_ACCEPT_THRESHOLD
    ) {
      const winner = ranked[0]!;
      const updated = await this.database.update(
        this.transactionTableRef,
        { id: transaction.id, userId: input.userId },
        { categoryId: winner.id, status: 'CATEGORIZED' },
      );
      await this.writeCacheBestEffort(normalized, winner.id);
      return updated;
    }

    // ── LLM AMBIGUITY (REQ-TC-005) ─────────────────────────────────────────
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

    // ── WRITE + CACHE (REQ-TC-006) ─────────────────────────────────────────
    const updated = await this.database.update(
      this.transactionTableRef,
      { id: transaction.id, userId: input.userId },
      { categoryId: selected.id, status: 'CATEGORIZED' },
    );
    await this.writeCacheBestEffort(normalized, selected.id);
    return updated;
  }

  /**
   * REQ-TC-009: normalize the merchant before cache I/O. Trims, collapses
   * internal whitespace runs to a single space, and lower-cases. Defensive:
   * no throw on already-normalized input.
   */
  private normalize(merchant: string): string {
    return merchant.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Best-effort cache write. Wrapped in try/catch so a cache failure does
   * NOT fail the transaction (REQ-TC-008). The cache is an optimization —
   * the canonical record is the transactions table.
   */
  private async writeCacheBestEffort(
    merchant: string,
    categoryId: string,
  ): Promise<void> {
    try {
      await this.merchantCachePort.save(merchant, categoryId);
    } catch (err) {
      console.warn('merchant cache write failed', { merchant, err });
    }
  }

  private async resolveCategoryIdBySlug(
    slug: string,
  ): Promise<string | null> {
    if (!this.database.query) {
      throw new Error('CategorizeTransactionUseCase: database adapter does not support raw queries');
    }
    const rows = await this.database.query<CategoryRow>(CATEGORY_BY_SLUG_SQL, [
      slug,
    ]);
    return rows[0]?.id ?? null;
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

// KEYWORDS is re-exported so the use case's transitive dependency on the
// keyword map is explicit (composition roots can trace the data flow).
export { KEYWORDS };
