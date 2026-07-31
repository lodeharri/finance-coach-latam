/**
 * Merchant cache port.
 *
 * The categorizer short-circuits the LLM when an existing successful
 * categorization for the same normalized merchant is found in
 * `merchant_category_cache`, and writes back to it after every successful
 * categorization (REQ-TC-002, REQ-TC-006).
 *
 * Implementations (e.g. `MerchantCacheAdapter`) translate this domain port
 * into the underlying persistence layer. Use cases depend on the interface,
 * never on a concrete adapter, so the cache backend stays swappable.
 */
export interface MerchantCachePort {
  /**
   * Look up the cached category for a normalized merchant.
   *
   * @returns The cached `categoryId`, or `null` when the merchant has never
   *   been categorized.
   */
  findByMerchant(merchant: string): Promise<{ categoryId: string } | null>;

  /**
   * Persist a `(merchant, categoryId)` mapping. MUST be idempotent — a
   * concurrent transaction for the same merchant MUST NOT throw.
   */
  save(merchant: string, categoryId: string): Promise<void>;

  /**
   * Delete every cache row whose `category_id` matches.
   *
   * Called by admin PATCH/DELETE on a category so future transactions
   * re-classify against the new identity (REQ-AC-008).
   *
   * Implementations MUST be tolerant of `categoryId` values that have no
   * matching rows — the operation is idempotent at the cache layer.
   */
  invalidateByCategoryId(categoryId: string): Promise<void>;
}