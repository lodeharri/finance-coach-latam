import type { Category } from '../../domain/entities/category.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import type { MerchantCachePort } from '../../domain/ports/merchant-cache.port';
import { assertIsAdmin, type Actor } from './authorization';

export interface DeleteCategoryInput {
  readonly actor: Actor;
  readonly id: string;
}

/**
 * Delete a category row from `categories`.
 *
 * Flow:
 *  1. assertIsAdmin → 403 on non-admin.
 *  2. select(id) → 404 'Category not found' when the row is absent.
 *  3. Best-effort cache invalidation (`merchantCache.invalidateByCategoryId`).
 *     A failure here is logged with console.warn and swallowed so the delete
 *     still lands — REQ-AC-008 treats cache cleanup as advisory.
 *  4. `database.delete(id)` wrapped in try/catch. If the underlying Postgres
 *     DELETE raises a `foreign key` violation (SQLSTATE 23503 — at least one
 *     transaction still references the category_id), the use case re-throws
 *     `Error('Category in use by transactions')` so the route maps it to 409
 *     via the `startsWith('Category in use by transactions')` prefix match.
 *     Any other error from the DB propagates unchanged.
 *
 * Postgres error-message substrings can drift across versions; if the
 * 'foreign key' heuristic breaks against a future driver, raise a follow-up
 * sdd-propose to revisit the mapping.
 */
export class DeleteCategoryUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly categoryTableRef: TableRef<Category>,
    private readonly merchantCache: MerchantCachePort,
  ) {}

  async execute(input: DeleteCategoryInput): Promise<void> {
    assertIsAdmin(input.actor); // REQ-AC-007

    const existing = await this.database.select(this.categoryTableRef, {
      where: { id: input.id },
      limit: 1,
    });
    if (existing.length === 0) {
      // routeError matches the 'not found' substring to 404.
      throw new Error('Category not found');
    }

    // REQ-AC-008: cache invalidation is best-effort. We run it BEFORE the
    // delete so that even an FK-blocked delete leaves the cache clean — the
    // remaining (referenced) category will re-derive cache rows from scratch
    // on the next successful categorization.
    try {
      await this.merchantCache.invalidateByCategoryId(input.id);
    } catch (err) {
      console.warn('category cache invalidation failed', { id: input.id, err });
    }

    try {
      await this.database.delete(this.categoryTableRef, { id: input.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('foreign key')) {
        // Postgres SQLSTATE 23503 surfaces as a `foreign key` substring in
        // Drizzle's wrapped error.message. Re-throw a stable, route-friendly
        // prefix so the categories.routes.ts DELETE branch can match it.
        throw new Error('Category in use by transactions');
      }
      throw error;
    }
  }
}
