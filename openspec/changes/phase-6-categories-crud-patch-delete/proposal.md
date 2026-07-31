# Proposal: Categories CRUD — PATCH and DELETE

> Change: `phase-6-categories-crud-patch-delete` — close the admin `/categories` CRUD loop with PATCH (edit name/color, re-embed, invalidate cache) and DELETE (remove row, invalidate cache).

## Why

Phase-5 shipped `POST` + `GET /categories`; admins can only create and read. No way to rename, recolor, or retire a category without redeploy. Phase-5 explicitly deferred this work and flagged cache invalidation as the follow-up. This change delivers both.

## What Changes

| ID | Deliverable |
|----|-------------|
| P1 | `update-category.use-case.ts`. `assertIsAdmin` → SELECT (404 if missing) → validate color regex if present → `database.update` → fire-and-forget `llm.embed(name + ' ' + slug)` (same `persistEmbedding` pattern as `CreateCategoryUseCase`) → best-effort `merchantCache.invalidateByCategoryId(id)`. Returns updated `Category`. Embedding failure logs WARN, does not roll back. |
| P2 | `delete-category.use-case.ts`. `assertIsAdmin` → SELECT (404 if missing) → best-effort cache invalidate → `database.delete`. FK violation on `transactions.category_id` re-throws `Error('Category in use by transactions')` for the route to map to 409. Returns void. |
| P3 | `PATCH /categories/{id}` + `DELETE /categories/{id}` branches in `categories.routes.ts`. PATCH body: optional `name`, optional `color`, at least one required (else 400). DELETE has no body. Both inherit the route's `authenticate()` actor. |
| P4 | Extend `MerchantCachePort` with `invalidateByCategoryId(categoryId): Promise<void>`; implement in `MerchantCacheAdapter` as `DELETE FROM merchant_category_cache WHERE category_id = $1`. Wire into both new use cases. |
| P5 | Composition root: `UpdateCategoryUseCase(database, categoryTableRef, llm, merchantCache)` + `DeleteCategoryUseCase(database, categoryTableRef, merchantCache)`; pass through `createApiRoutes` deps. |
| P6 | Strict-TDD tests: `update-category.use-case.test.ts`, `delete-category.use-case.test.ts`, extend `categories.routes.test.ts` — see Acceptance Criteria. |

## Scope

**In scope**: P1–P6; one new port method on `MerchantCachePort` + adapter implementation.
**Out of scope**: frontend; soft-delete; slug rename; cascade delete (409 surfaces, admin unassigns manually); LLM provider changes; create-category cache invalidation (phase-5 TODO stays — fresh slugs have no cache rows yet).

## Approach

**PATCH flow**: `authenticate` → parse body → if `color` present, regex-validate → use case → 200. Use case: `assertIsAdmin` → SELECT (404) → regex-validate (defense-in-depth) → `database.update` → `void persistEmbedding(id, newName, existing.slug)` → `try { await merchantCache.invalidateByCategoryId(id) } catch (warn)`.

**DELETE flow**: `authenticate` → use case → 204 (or 409). Use case: `assertIsAdmin` → SELECT (404) → best-effort cache invalidate → `database.delete`; FK violation on `transactions.category_id` re-throws as plain `Error('Category in use by transactions')`.

**Cache invalidation**: `MerchantCachePort.invalidateByCategoryId` → adapter SQL. Use case wraps in `try/catch` + `console.warn` on failure. After invalidation, future transactions fall through cache → keyword → embed → auto-accept → `generateText` (existing cold path). Closes the FK gap that would otherwise break the cache write path after a category is deleted.

**Capabilities (sdd-spec contract)**: Modified capability `admin-categories` — add PATCH/DELETE requirements and scenarios (delta spec at `openspec/changes/phase-6-categories-crud-patch-delete/specs/admin-categories/spec.md`). No new capability. `authorization` and `transaction-categorization` specs unchanged.

## Risks

| Risk | Mitigation |
|------|------------|
| Embedding recompute races in-flight transactions | Fire-and-forget; transactions snapshot `categoryId`, stale cache reads last seconds |
| DELETE on heavily-referenced category leaves 409 forever | 409 message tells admin to unassign; no UI built here (out of scope) |
| Cache invalidation fails silently | WARN log; non-blocking by design; acceptable for demo |
| Slug not updatable | Documented; deferred |

## Acceptance Criteria

1. PATCH admin + name only → 200, embedding recompute triggered, cache invalidated.
2. PATCH admin + color only → 200, no embedding recompute.
3. PATCH admin + both → 200, embedding uses new name.
4. PATCH non-admin → 403, no DB write.
5. PATCH invalid color → 400, no DB write.
6. PATCH both fields missing → 400.
7. PATCH unknown id → 404.
8. PATCH `llm.embed` throws → 200, WARN logged, cache still invalidated.
9. DELETE admin → 204, row deleted, cache invalidated.
10. DELETE non-admin → 403, no DB write.
11. DELETE unknown id → 404.
12. DELETE with referenced transactions → 409 (route maps prefix to HttpError 409).
13. `MerchantCachePort.invalidateByCategoryId` exists in interface and adapter.
14. All prior tests remain green.

## Rollback Plan

Revert the two new use case files, PATCH/DELETE route branches, port extension, adapter method, and composition wiring. No DB migration; tables unchanged. No destructive data — only demo data affected.

## Open Questions

None. All decisions locked: name-only or color-only allowed; color regex `^#[0-9A-Fa-f]{6}$`; embedding fire-and-forget (failure non-fatal); cache invalidation best-effort (failure non-fatal); slug NOT updatable; FK conflict → 409; cache invalidation on the port (not raw SQL in use case).
