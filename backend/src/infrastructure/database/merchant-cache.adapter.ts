import type {
  MerchantCachePort,
} from '../../domain/ports/merchant-cache.port';
import type { DatabasePort } from '../../domain/ports/database.port';

const SELECT_SQL =
  'SELECT category_id FROM merchant_category_cache WHERE merchant = $1 LIMIT 1';

const INSERT_SQL =
  'INSERT INTO merchant_category_cache (merchant, category_id) ' +
  'VALUES ($1, $2) ON CONFLICT (merchant) DO NOTHING';

/**
 * Neon-backed implementation of {@link MerchantCachePort}.
 *
 * Talks to `merchant_category_cache` through the `DatabasePort.query` escape
 * hatch so the domain layer stays free of raw SQL. `save` is idempotent
 * (REQ-TC-006): concurrent transactions for the same merchant collide on the
 * primary key and the `ON CONFLICT DO NOTHING` clause swallows the conflict.
 */
export class MerchantCacheAdapter implements MerchantCachePort {
  constructor(private readonly database: DatabasePort) {}

  private requireQuery(): Required<DatabasePort>['query'] {
    if (!this.database.query) {
      throw new Error(
        'MerchantCacheAdapter: database adapter does not support raw queries',
      );
    }
    return this.database.query;
  }

  async findByMerchant(
    merchant: string,
  ): Promise<{ categoryId: string } | null> {
    const rows = await this.requireQuery()<{ category_id: string }>(SELECT_SQL, [
      merchant,
    ]);
    const row = rows[0];
    return row ? { categoryId: row.category_id } : null;
  }

  async save(merchant: string, categoryId: string): Promise<void> {
    await this.requireQuery()(INSERT_SQL, [merchant, categoryId]);
  }
}