# Tasks: phase-5-categorizer-optimizations-and-admin-categories

> Change: `phase-5-categorizer-optimizations-and-admin-categories`
> Inputs read: `proposal.md`, `spec.md`, `design.md`, `specs/transaction-categorization/spec.md`, `specs/admin-categories/spec.md`, `specs/authorization/spec.md`, plus the three existing use-case tests + the source for `authorization.ts`, `categorize-transaction.use-case.ts`, `create-user.use-case.ts`, `list-users.use-case.ts`, `categories.routes.ts`, both composition roots, the Drizzle schema, and the `NeonDatabaseAdapter`.

## 1. Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated total changed lines (additions + deletions) | ~625 LoC across 4 slices |
| Slice 1 (Authorization + assertIsAdmin) | ~50 LoC |
| Slice 2 (Cache table + port + adapter + migration) | ~60 LoC |
| Slice 3 (KEYWORDS + CategorizeTransactionUseCase rewrite + tests + wiring) | ~365 LoC (borderline) |
| Slice 4 (CreateCategoryUseCase + POST /categories + wiring) | ~160 LoC |
| Slices exceeding 400-line budget | None individually; Slice 3 is borderline (~365) and depends on test-line economy |
| Total change vs single-PR budget | **Hard overflow** — total ~625 LoC > 400 |
| Delivery strategy | `ask-on-risk` |
| Chained PRs recommended | **Yes** — total >400 forces chaining; Slice 3 borderline should be split only if measured diff at apply-time exceeds 400 |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending (orchestrator will ask: stacked-to-main vs feature-branch-chain)
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| Slice 1 | Single source of truth for admin gating | PR 1 | `pnpm --filter backend test authorization create-user list-users` | typecheck + `vitest run` in `backend/` | revert 1 commit; both old inline checks restored, test assertions reverted |
| Slice 2 | Persistence layer for merchant cache (table + port + adapter) | PR 2 | `pnpm --filter backend typecheck` | typecheck only (no new use-case test); `drizzle-kit generate` to confirm migration is idempotent | `DROP TABLE merchant_category_cache` + revert code commits; safe — table is additive |
| Slice 3 | Categorizer short-circuits + tests + wiring | PR 3 | `pnpm --filter backend test categorize-transaction category-keywords` | typecheck + `vitest run` with mocked LLM; verify 9 new scenarios + the modified `Shell`→`PedidosYa` scenario | revert 1 commit per code/test pair; categorizer falls back to baseline behavior because KEYWORDS + cache are inert when code is removed |
| Slice 4 | Admin POST /categories end-to-end | PR 4 | `pnpm --filter backend test create-category categories.routes` | typecheck + `vitest run`; manual `curl POST /categories` with admin + non-admin tokens | revert 1 commit per code/test pair; route falls back to GET-only; use case deleted |

## 2. Chained PR Strategy

- **Total >400 → chained PRs are mandatory.** `ask-on-risk` delivery strategy → orchestrator MUST ask user before apply.
- **Strategy options to surface**: stacked-to-main vs feature-branch-chain. Do not pre-select.
- **Slice order and bases** (once user picks):
  - PR 1 (Slice 1): base `main`, merge `main` after CI green. No deps.
  - PR 2 (Slice 2): base `main` (after PR 1 merged), merge `main`. Depends on PR 1 only because refactor of inline checks unblocks the API composition chain — but Slice 2 does not strictly need Slice 1. So PR 2 base = `main` is fine if PR 1 already merged.
  - PR 3 (Slice 3): base `main` (after PR 1 + PR 2 merged). Depends on Slice 2 (MerchantCachePort). Strict dependency.
  - PR 4 (Slice 4): base `main` (after PR 1 merged). Depends only on Slice 1 (assertIsAdmin). Strict dependency.
  - **Parallel eligibility**: PR 4 can run in parallel with PR 2 + PR 3 (different files, no overlap). Track this with the user.
- **Feature-branch-chain alternative**: tracker branch `feature/phase-5-categorizer-and-admin`; PR 1 targets tracker; PR 2 targets PR 1 branch; PR 3 targets PR 2 branch; PR 4 targets PR 1 branch.
- **Stacked-to-main alternative**: each PR merges to `main` in order; PR 4 may merge concurrently with PR 2/3 once PR 1 is green.

## 3. Tasks by Slice

### Slice 1: Authorization refactor + assertIsAdmin

- [x] **T1.1** Add `assertIsAdmin(actor: Actor): void` to `backend/src/application/use-cases/authorization.ts` — code, ~5 LoC — satisfies REQ-AZ-002, REQ-AZ-003 — blocks T1.3, T1.4
- [x] **T1.2** Add `backend/src/application/use-cases/authorization.test.ts` with three scenarios (admin returns void, non-admin throws `'Forbidden'`, `assertCanActAs` smoke) — test, ~30 LoC — satisfies REQ-AZ-002, REQ-AZ-003, REQ-AZ-001
- [x] **T1.3** Refactor `CreateUserUseCase.execute` to call `assertIsAdmin({ userId: 'system', role: input.actorRole })` and update `create-user.use-case.test.ts:93` to `'Forbidden: admin role required'` — code + test in same commit, ~5 LoC use case + 1 LoC test = ~6 LoC — satisfies REQ-AZ-002 — blocks T1.5
- [x] **T1.4** Refactor `ListUsersUseCase.execute` to call `assertIsAdmin({ userId: 'system', role: input.actorRole })` and update `list-users.use-case.test.ts:38` to `'Forbidden: admin role required'` — code + test in same commit, ~5 LoC use case + 1 LoC test = ~6 LoC — satisfies REQ-AZ-002 — blocks T1.5
- [x] **T1.5** Run `pnpm --filter backend test authorization create-user list-users` and confirm 4 existing tests + 3 new tests green — verification, 0 LoC — unblocks Slice 4
- **Slice 1 total: ~47 LoC** (well under 400).

### Slice 2: merchant_category_cache migration + Drizzle schema + MerchantCachePort + MerchantCacheAdapter (Neon) + composition wiring

> Per work-unit-commits: migration is its own commit BEFORE the cache code that uses the table. Both the Drizzle schema and the SQL file must land before the use case in Slice 3 can compile.

- [ ] **T2.1** Add `0003_merchant_category_cache.sql` migration under `backend/drizzle/` — migration, ~15 LoC — satisfies REQ-TC-002, REQ-TC-006 (storage layer) — blocks T2.3
- [ ] **T2.2** Add `merchantCategoryCacheTable` + `MerchantCategoryCacheRow` + `MerchantCategoryCacheInsert` to `backend/src/infrastructure/database/drizzle/schema.ts` — code, ~12 LoC — satisfies REQ-TC-002 — blocks T2.4
- [ ] **T2.3** Create `backend/src/domain/ports/merchant-cache.port.ts` exporting `MerchantCachePort` interface (`findByMerchant`, `save`) — code, ~5 LoC — satisfies REQ-TC-002, REQ-TC-006 — blocks T2.5
- [ ] **T2.4** Add `findByMerchant(merchant)` and `save(merchant, categoryId)` to `NeonDatabaseAdapter` in `backend/src/infrastructure/database/neon-database.adapter.ts` (use existing `query` escape hatch + `ON CONFLICT DO NOTHING`) — code, ~20 LoC — satisfies REQ-TC-002, REQ-TC-006 — blocks T2.5
- [ ] **T2.5** Create `backend/src/infrastructure/cache/merchant-cache.adapter.ts` exporting `MerchantCacheAdapter` implementing `MerchantCachePort` (passthrough to `NeonDatabaseAdapter`) — code, ~10 LoC — satisfies REQ-TC-002, REQ-TC-006 — blocks Slice 3
- [ ] **T2.6** Run `pnpm --filter backend typecheck` and confirm no compile errors — verification, 0 LoC
- **Slice 2 total: ~62 LoC** (well under 400).

### Slice 3: KEYWORDS map + CategorizeTransactionUseCase rewrite + 9 new scenarios + composition wiring

> This is the largest slice (~365 LoC). Borderline — apply agent MUST measure the actual diff before opening the PR and split further if `git diff --stat` against the base shows >400 lines (work-unit-commits rule). Split fallback: 3a (KEYWORDS + use case code) vs 3b (tests + wiring).

- [ ] **T3.1** Create `backend/src/domain/keywords/category-keywords.ts` with the `KEYWORDS` map (16 entries) and `matchKeyword(merchant)` pure function — code, ~25 LoC — satisfies REQ-TC-001, REQ-TC-009 — blocks T3.2, T3.3
- [ ] **T3.2** Create `backend/src/domain/keywords/category-keywords.test.ts` covering every seed entry, case-insensitivity, unknown merchant, normalization edge cases — test, ~50 LoC — satisfies REQ-TC-001, REQ-TC-009 — blocks T3.3
- [ ] **T3.3** Rewrite `CategorizeTransactionUseCase.execute()` per design Section 1 (keyword → cache → embed+auto-accept → ambiguity → cache write); add 4th constructor arg `merchantCachePort: MerchantCachePort`; add private `normalize(merchant)`; add module-level `AUTO_ACCEPT_THRESHOLD = 0.5` — code, ~90 LoC — satisfies REQ-TC-001 through REQ-TC-009 — blocks T3.4, T3.5, T3.6
- [ ] **T3.4** Extend `backend/src/application/use-cases/categorize-transaction.use-case.test.ts`: (a) modify existing `'Shell'`→`'PedidosYa'` in the `uses pgvector` scenario so the keyword layer does NOT short-circuit; (b) add `MerchantCachePort` mock to `beforeEach`; (c) add the 9 new scenarios from design Section 8 (keyword hit, cache hit, auto-accept single row, auto-accept ratio < 0.5, ambiguity ratio ≥ 0.5, embedding failure no-keyword, embedding failure with-keyword, cache write failure, smoke test for 5 transactions ≤ 1 `generateText`) — test, ~180 LoC — satisfies REQ-TC-001 through REQ-TC-009 — tests travel WITH the use-case commit (T3.3 + T3.4 are the SAME commit)
- [ ] **T3.5** Wire `MerchantCacheAdapter` + 4th constructor arg in `backend/src/lambdas/api/composition.ts` — code, ~5 LoC — satisfies composition contract — blocks T3.7
- [ ] **T3.6** Wire `MerchantCacheAdapter` + 4th constructor arg in `backend/src/lambdas/categorizer/composition.ts` — code, ~5 LoC — satisfies composition contract — blocks T3.7
- [ ] **T3.7** Run `pnpm --filter backend test categorize-transaction category-keywords` and confirm 4 (modified) + 9 (new) + keyword scenarios green — verification, 0 LoC
- **Slice 3 total: ~365 LoC** (borderline — apply agent must measure; if >400, split T3.4 (tests) from T3.3 (code) into two commits but keep them in the same PR).

### Slice 4: CreateCategoryUseCase + POST /categories route handler + route tests

- [ ] **T4.1** Create `backend/src/application/use-cases/create-category.use-case.ts` (`CreateCategoryUseCase` class, `CreateCategoryInput` interface, `persistEmbedding` private helper) — code, ~50 LoC — satisfies REQ-AC-001 through REQ-AC-005 — blocks T4.2
- [ ] **T4.2** Create `backend/src/application/use-cases/create-category.use-case.test.ts` with 6 scenarios: admin creates (no embedding), non-admin 403, duplicate slug, invalid color, embedding failure persists row, execute resolves before embedding — test, ~80 LoC — satisfies REQ-AC-001 through REQ-AC-005 — travels WITH T4.1 (same commit)
- [ ] **T4.3** Add `POST` branch + `HttpError(409)` re-throw for duplicate-slug to `backend/src/interfaces/http/categories.routes.ts`; expand `CategoriesRoutesDeps` with `createCategoryUseCase` — code, ~25 LoC — satisfies REQ-AC-001, REQ-AC-002, REQ-AC-005 HTTP-level — blocks T4.4
- [ ] **T4.4** Create `backend/src/interfaces/http/categories.routes.test.ts` with 5 scenarios: GET 200, POST admin 201, POST non-admin 403, POST duplicate slug 409, POST invalid color 400 — test, ~50 LoC — satisfies REQ-AC-001 through REQ-AC-005 HTTP-level — travels WITH T4.3 (same commit)
- [ ] **T4.5** Forward `createCategoryUseCase` through `ApiRoutesDeps` in `backend/src/interfaces/http/api.routes.ts`; instantiate `CreateCategoryUseCase(database, categoryTableRef, llm)` in `backend/src/lambdas/api/composition.ts` — code, ~10 LoC — satisfies composition contract — blocks T4.6
- [ ] **T4.6** Run `pnpm --filter backend test create-category categories.routes` and confirm green — verification, 0 LoC
- **Slice 4 total: ~215 LoC** (under 400).

**Grand total: ~689 LoC** across 4 slices — chained PR is mandatory.

## 4. Out-of-Scope Tasks (explicit non-goals)

- `DELETE /categories`, `PATCH /categories` — not in this change (admin scope reduced from original draft).
- Frontend (Phase 6) — deferred.
- LLM provider switch — out of scope.
- Paid tier upgrade (Cognito billing, Gemini tier change) — out of scope.
- GitHub Actions CI — out of scope.
- README updates — out of scope.
- Any change to `users` table schema, `cognito-bootstrap`, `JwtVerifierAdapter` — role stays Cognito-only.
- Cache invalidation hook on category rename — deferred TODO in `CreateCategoryUseCase` (per spec Locked Decision 2).
- New `icon` column on categories table — spec lists it in payload but schema does not have it; ignore in route handler (design Section 11 risk).
- Re-tuning the `AUTO_ACCEPT_THRESHOLD` beyond `0.5` — single constant in `CategorizeTransactionUseCase.ts`; future PR if data shows it's too aggressive.
- Bundle splitting of the `KEYWORDS` module — adds ~1 KB to API bundle; acceptable for reviewability (design Section 6).

## 5. Validation Strategy (per-slice smoke check)

| Slice | Typecheck | Unit tests | Runtime harness |
|-------|-----------|------------|-----------------|
| Slice 1 | `pnpm --filter backend typecheck` | `pnpm --filter backend test authorization create-user list-users` — expect 4 existing + 3 new | manual: grep `'Forbidden: admin role required'` appears in both use cases and the helper |
| Slice 2 | `pnpm --filter backend typecheck` | no new use-case test yet; `drizzle-kit generate` re-run must NOT regenerate 0003 (idempotent) | manual: `psql ... -c "SELECT 1 FROM merchant_category_cache LIMIT 1"` on dev DB |
| Slice 3 | `pnpm --filter backend typecheck` | `pnpm --filter backend test categorize-transaction category-keywords` — expect 4 (modified) + 9 new + keyword scenarios | manual: replay 5 transactions (Shell, YPF, Spotify, PedidosYa, OSDE) through `useCase.execute` with mocked ports and assert `generateText` called ≤ 1 time |
| Slice 4 | `pnpm --filter backend typecheck` | `pnpm --filter backend test create-category categories.routes` — expect 6 + 5 new | manual: `curl POST /categories` with admin JWT returns 201, with non-admin returns 403, with duplicate slug returns 409 |

## 6. Carry-over Risks

| Risk | Status | Mitigation |
|------|--------|------------|
| The 2 refactored inline admin checks (CreateUserUseCase, ListUsersUseCase) change the error message string. The 2 existing test assertions MUST be updated in the SAME commit as the use-case refactor. | carried forward | T1.3 + T1.4 already group code + test update in one task. Work-unit-commits: tests with code. |
| The existing `CategorizeTransactionUseCase.uses pgvector` test uses `merchant: 'Shell'`. After Slice 3, `'shell'` matches the new keyword map → keyword layer short-circuits → `embed` is never called → existing assertion breaks. | carried forward (design Section 8) | T3.4 explicitly changes merchant to `'PedidosYa'` so the embedding + LLM path still runs in the existing test. Verify the exact diff in apply. |
| Slice 3 ~365 LoC is borderline; if test lines balloon (each scenario ~20 LoC) the diff can exceed 400. | NEW (sizing) | Apply agent must `git diff --stat` before opening PR 3; if >400, split T3.4 (tests) from T3.3 (use-case code) into two chained commits inside the SAME PR, or push keyword code+tests into a separate slice. |
| `CategorizeTransactionUseCase` constructor signature change (4th arg `merchantCachePort`) breaks both composition roots. | carried forward | T3.5 + T3.6 update both `api/composition.ts` and `categorizer/composition.ts` in the same slice. |
| `CreateCategoryUseCase` returns 201 before the embedding completes; concurrent `POST /transactions/{id}/categorize` may not see the new category. | carried forward | Spec REQ-AC-004 documents this. Similarity query already filters `WHERE embedding IS NOT NULL`. A retry later picks the new category up. |
| Auto-accept threshold `0.5` is hardcoded — may be too aggressive for some categories. | carried forward | Single constant; T3.4 includes the boundary test (`distances [0.10, 0.40]`) per design Section 8. |
| `assertIsAdmin` does not check `actor.userId` non-empty. | NEW | Out of scope per design Section 11. `authenticate()` upstream catches malformed tokens. |
| Race on cache writes for the same merchant under concurrent transactions. | NEW | `ON CONFLICT (merchant) DO NOTHING` makes the insert idempotent. Document in `MerchantCacheAdapter.save`. |
| Slice 4 (POST /categories) is independent of Slice 3 — they can be merged in parallel after Slice 1. | NEW | Surface this in the user-facing question; recommend parallel eligibility. |

## 7. Total Forecast (recap)

- Slice 1: ~47 LoC
- Slice 2: ~62 LoC
- Slice 3: ~365 LoC (borderline; split if measured >400)
- Slice 4: ~215 LoC
- **Grand total: ~689 LoC** — chained PR mandatory; orchestrator must ask user for chain strategy before apply.