# Tasks: phase-6-categories-crud-patch-delete

Closes the admin `/categories` CRUD loop with `PATCH` (name/color + cache invalidation + fire-and-forget embed) and `DELETE` (FK-safe + cache invalidation). Mirrors `CreateCategoryUseCase` patterns.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Total estimated LoC (additions + deletions) | ~770 |
| Tasks > 100 LoC | T5 (~250), T6 (~200), T10 (~180) |
| Total > 400 LoC budget | **Yes** (~370 over) |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Delivery strategy | ask-on-risk |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Recommended Chain — 2-PR `feature-branch-chain`

User must pick chain strategy before apply (`ask-on-risk`). Two viable options:

| Option | Split | PR 1 LoC | PR 2 LoC | Tradeoff |
|--------|-------|---------:|---------:|----------|
| **A** (recommended) | feature-branch-chain | T1,T2,T3,T4,T5,T7,T8,T9,T10,T11-Update = ~440 ⚠️ | T6,T8-DELETE-add,T10-DELETE-add,T11-Delete = ~310 ✓ | Slight over-budget on PR 1 by ~10% to ship UpdateCategory as a complete vertical slice. Clean rollback: revert PR 1 leaves DeleteCategory untouched. |
| B (strict budget) | feature-branch-chain | T1,T2,T3,T4,T5 = ~360 ✓ | T6,T7,T8,T9,T10,T11 = ~410 ⚠️ | Both PRs near budget. PR 2 leaves DeleteCategory reachable but UpdateCategory stranded until PR 1's HTTP branch lands later. Awkward. |
| C | `size:exception` | single PR = ~770 | — | One-review delivery; needs explicit maintainer approval. Loses rollback granularity. |

**Option A is recommended.** Decision needed before apply: accept ~10% over-budget on PR 1 (UpdateCategory end-to-end) OR pick option B/C.

### Suggested Work Units (one commit = one task)

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| U1 | `MerchantCachePort` + adapter expose `invalidateByCategoryId` | PR 1 (foundation slice) | `npx vitest run merchant-cache.adapter.test.ts` | N/A (in-memory mock at unit layer) | revert `domain/ports/merchant-cache.port.ts` + `infrastructure/database/merchant-cache.adapter.ts` |
| U2 | `DatabasePort.delete` + Drizzle adapter | PR 1 (foundation slice) | `npx vitest run neon-database.adapter` | N/A | revert `database.port.ts` port method + adapter impl |
| U3 | `UpdateCategoryUseCase` with 7 strict-TDD tests | PR 1 | `npx vitest run update-category.use-case.test.ts` | N/A | revert `update-category.use-case.ts` + tests |
| U4 | CORS `Allow-Methods` widened; `categories.routes.ts` PATCH branch | PR 1 | `npx vitest run categories.routes.test.ts` (PATCH tests only) | `curl -X OPTIONS …` preflight + `curl -X PATCH …` against deployed API (out of scope here, called out in design) | revert `http.utils.ts` CORS + `categories.routes.ts` PATCH branch |
| U5 | `DeleteCategoryUseCase` with 5 strict-TDD tests | PR 2 | `npx vitest run delete-category.use-case.test.ts` | N/A | revert use case file + tests |
| U6 | `categories.routes.ts` DELETE branch + 6 PATCH/DELETE route tests; composition wire for both | PR 2 | `npx vitest run categories.routes.test.ts` | N/A | revert DELETE branch + DELETE tests + composition wiring |

## Phase 1: Foundation — Port + Adapter Extensions

- [x] **T1 — Extend `MerchantCachePort`** — Add `invalidateByCategoryId(categoryId: string): Promise<void>` to `backend/src/domain/ports/merchant-cache.port.ts` with JSDoc pointing at REQ-AC-008. Type: `code`. LoC: ~14. Depends on: none. Acceptance: REQ-AC-008.
- [x] **T2 — Implement `invalidateByCategoryId` in adapter + test** — Add `INVALIDATE_SQL = 'DELETE FROM merchant_category_cache WHERE category_id = $1'` and method to `backend/src/infrastructure/database/merchant-cache.adapter.ts`. Extend `merchant-cache.adapter.test.ts` with one scenario asserting SQL + param. Type: `code+test`. LoC: ~30. Depends on: T1. Acceptance: REQ-AC-008.
- [x] **T3 — Add `delete()` to `DatabasePort`** — Declare `delete<TEntity>(table: TableRef<TEntity>, where: Partial<TEntity>): Promise<void>` in `backend/src/domain/ports/database.port.ts` (mirrors `update`, throws when `where` is empty). Type: `code`. LoC: ~10. Depends on: none. Acceptance: REQ-AC-007.
- [x] **T4 — Implement `delete()` in `NeonDatabaseAdapter` + test** — Implement via Drizzle `.delete(pgTable).where(and(...conditions))`, reject when no conditions. Add unit test in a new `neon-database.adapter.test.ts` (if absent) or co-located test asserting the SQL path. Type: `code+test`. LoC: ~55. Depends on: T3. Acceptance: REQ-AC-007.

## Phase 2: Use Cases (TDD, tests in same commit as impl)

- [x] **T5 — `UpdateCategoryUseCase` impl + 7 tests** — Mirror `CreateCategoryUseCase` (no async refactor beyond copying `persistEmbedding`). `assertIsAdmin` → optional `HEX_COLOR` defense-in-depth → `select` (404 on empty) → `update` (non-undefined patch fields) → conditional `void persistEmbedding(id, newName, existing.slug)` only when `patch.name` set → best-effort `try{ await merchantCache.invalidateByCategoryId(id) }` with `console.warn`. Tests: (1) admin name-only → 200 + embed fires + cache invalidated; (2) admin color-only → embed NOT called + cache invalidated; (3) admin both → embed uses new name; (4) non-admin → 403, no DB write, no embed; (5) invalid color → 400-style error, no DB write; (6) `llm.embed` throws → 200 + WARN + cache still invalidated; (7) not found → 404 error. Files: `backend/src/application/use-cases/update-category.use-case.ts` (new) + `update-category.use-case.test.ts` (new). Type: `code+test`. LoC: ~250. Depends on: T1, T2. Acceptance: REQ-AC-006, REQ-AC-008.

> **PR1 task renumber note** (PR1 re-scoped to UpdateCategory only, scoped by orchestrator): in this PR1 implementation, the user labeled the tasks T1–T6 with the following mapping: T1 = port signature, T2 = adapter impl, T3 = adapter tests, T4 = UpdateCategoryUseCase RED, T5 = UpdateCategoryUseCase GREEN, T6 = UpdateCategoryUseCase REFACTOR + TRIANGULATE. The 12 UpdateCategoryUseCase scenarios cover the original T5 spec's 7 scenarios plus 5 edge cases (empty name, same-name idempotency, invalid color short-hex, FK/constraint re-throw, both-fields-with-cache-failure path).

- [x] **T6 — `DeleteCategoryUseCase` impl + 5 tests** — `assertIsAdmin` → `select` (404 on empty) → best-effort `merchantCache.invalidateByCategoryId` (WARN on fail) → `database.delete` wrapped in try/catch that re-throws `Error('Category in use by transactions')` when message contains `'foreign key'` (Postgres SQLSTATE `23503`). Tests: (1) admin → delete + cache invalidated; (2) non-admin → 403, no DB write, no cache; (3) not found → 404; (4) FK conflict → `Category in use by transactions`; (5) cache invalidation failure → delete still succeeds, WARN. Files: `backend/src/application/use-cases/delete-category.use-case.ts` (new) + `delete-category.use-case.test.ts` (new). Type: `code+test`. LoC: ~200. Depends on: T1, T2, T3, T4. Acceptance: REQ-AC-007, REQ-AC-008.

## Phase 3: HTTP Surface (CORS + route branches)

- [x] **T7 — Widen CORS `Allow-Methods`** — Change `'GET,POST,OPTIONS'` to `'GET,POST,PATCH,DELETE,OPTIONS'` in `backend/src/interfaces/http/http.utils.ts` line 30. Type: `config`. LoC: ~1. Depends on: none. Acceptance: preflight for PATCH/DELETE.
- [x] **T8 — Extend `categories.routes.ts` PATCH + DELETE + `CategoriesRoutesDeps`** — Add `updateCategoryUseCase` + `deleteCategoryUseCase` readonly deps. After GET/POST branches, add regex `/^\/categories\/[^/]+$/` for id-match; PATCH pre-validates `name` (string+trim or absent), `color` (string+trim or absent), rejects both absent (400), pre-validates `HEX_COLOR` (400) before use case. PATCH returns 200 with body. DELETE calls use case, returns 204; `try/catch` maps `startsWith('Category in use by transactions')` → `HttpError(409)`. Type: `code`. LoC: ~75. Depends on: T5 (PATCH), T6 (DELETE). Acceptance: REQ-AC-006, REQ-AC-007, REQ-AC-008.
- [x] **T9 — Extend `api.routes.ts` path dispatch + `ApiRoutesDeps`** — Replace `event.rawPath === '/categories'` with `event.rawPath === '/categories' || /^\/categories\/[^/]+$/.test(event.rawPath)`. Add `updateCategoryUseCase` + `deleteCategoryUseCase` to `ApiRoutesDeps`. Type: `code`. LoC: ~12. Depends on: T5, T6. Acceptance: routes reach the handler.
- [x] **T10 — Categories routes tests for PATCH + DELETE** — Extend `backend/src/interfaces/http/categories.routes.test.ts`: extend `makeEvent` to accept `path` and `'PATCH'|'DELETE'`. Add 6 scenarios: PATCH admin+name → 200; PATCH non-admin → 403; PATCH empty body → 400; PATCH invalid color → 400; DELETE admin → 204; DELETE FK conflict → 409. Mock `updateCategoryUseCase.execute` mirroring `createCategoryUseCase` admin-gate pattern. Type: `test`. LoC: ~180. Depends on: T5, T6, T8. Acceptance: REQ-AC-006, REQ-AC-007.

## Phase 4: Composition Wiring

- [x] **T11 — Wire `UpdateCategoryUseCase` + `DeleteCategoryUseCase` in `composition.ts`** — Construct both with existing `database`, `categoryTableRef`, `llm`, `merchantCache`; pass through to `createApiRoutes({ ... })`. Update `ApiRoutesDeps` typing in `api.routes.ts` (already covered by T9). Files: `backend/src/lambdas/api/composition.ts`. Type: `code`. LoC: ~10. Depends on: T5, T6, T9. Acceptance: REQ-AC-006, REQ-AC-007, REQ-AC-008.

## Validation Strategy (per slice)

After **PR 1**:
- `cd backend && npx vitest run merchant-cache.adapter.test.ts update-category.use-case.test.ts categories.routes.test.ts` — ≥ 7 new tests pass; existing 78 still green.
- `cd backend && npx tsc --noEmit` — clean.
- `cd infra && npx cdk synth FinanceCoachStack` — clean.

After **PR 2**:
- `cd backend && npx vitest run` — full suite: 78 + 5 + ~10 = ~93+ tests passing.
- `cd backend && npx tsc --noEmit` — clean.
- `cd infra && npx cdk synth FinanceCoachStack` — clean.

## DatabasePort.delete vs raw SQL — Decision

**Chosen: port-route.** Mirrors the existing `update` shape; keeps the domain layer free of raw SQL; FK error re-throwing lives in the use case (one file, one test). Adding `database.delete` on the port + Drizzle implementation on the adapter is mechanical work for a generic primitive; raw SQL would mean the use case reaches for `database.query` (a use-case reaching into infrastructure violates hexagonal). **Captured as T3 + T4.**

## Out-of-scope (explicit non-goals)

- Frontend / admin UI for PATCH/DELETE
- Cascading delete to `transactions` (FK prevents → 409 surfaces)
- Soft delete or `deleted_at` column
- Bulk operations (`PATCH /categories` plural)
- Slug rename (slugs are cache keys; renames invalidate every cache row)
- Category reordering / display ordering
- Cache invalidation in `CreateCategoryUseCase` (phase-5 TODO; fresh slugs have no rows yet)
- LLM provider changes or new ports
- New `DatabasePort.query` capabilities beyond what exists

## Carry-over Risks

| Risk | Mitigation |
|------|------------|
| Naming drift between `MerchantCachePort.invalidateByCategoryId` and the SQL constant `INVALIDATE_SQL` / adapter test | Keep all four call sites (`merchant-cache.port.ts`, `merchant-cache.adapter.ts`, `update-category.use-case.ts`, `delete-category.use-case.ts`) referencing the exact symbol `invalidateByCategoryId` |
| CORS regression for preflight on PATCH/DELETE when a CDN/proxy strips headers | Note in PR description; only the API Gateway integration sends CORS today; revisit when FE lands |
| `DatabasePort.delete` accidentally accepts empty `where` (mass delete) | Adapter throws `'at least one filter is required'` (mirrors `update`); port signature requires `Partial<TEntity>` non-undefined (caller must pass something) |
| FK violation `error.message` substring `'foreign key'` may drift across Postgres versions / Drizzle releases | Add a brief JSDoc on the use case describing the heuristic; if it drifts, surface in a follow-up `sdd-propose` |
| PR 1 slightly over 400 LoC budget (~440, ~10%) | Recommend user accepts Option A OR rebases into 3-PR chain (Option C deliverable, not Option B) |

## Tasks file cross-reference

- Tasks mapping to REQ-AC-006 (update): T5, T8, T10, T11
- Tasks mapping to REQ-AC-007 (delete): T3, T4, T6, T8, T10, T11
- Tasks mapping to REQ-AC-008 (cache invalidate): T1, T2, T5, T6, T11
