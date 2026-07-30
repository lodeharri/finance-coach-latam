# Proposal: Categorizer Optimizations and Admin Category Management

> Change: `phase-5-categorizer-optimizations-and-admin-categories` — reduce Gemini API usage by ~90% on the categorization path (keyword + cache + auto-accept), and enable admin-driven category management via `POST /categories`.

## Why

The `CategorizeTransactionUseCase` currently makes **two Gemini API calls per transaction** (`embed` + `generateText`) for every pending transaction in the demo seed (50 transactions). Two operational concerns motivate this change:

1. **Gemini free-tier quota risk.** The 15 RPM / 1,500 RPD limit on the free tier has been observed returning HTTP 429 under demo bursts. Each categorization burns at least 2 requests; re-running categorization on demand burns the budget fast. Reducing the steady-state to ~0 calls (keyword + cache hits) and only ~1 call (embed-only) on the cold path protects the budget.
2. **Admin onboarding cannot extend the category list.** Today, `CATEGORY_SEEDS` in `backend/src/lambdas/migration/seed.ts` is the only place new categories are added. That requires a redeploy + migration. Admins need `POST /categories` to add categories at runtime without redeploying.

The current behavior also has two duplicated inline admin checks (`CreateUserUseCase:21`, `ListUsersUseCase:12`) that re-implement `assertCanActAs` semantics; extracting them into a helper prevents drift.

## What Changes

### Part A — Categorizer optimizations (full scope)

| ID | Deliverable | Outcome |
|----|-------------|---------|
| A1 | New `backend/src/domain/keywords/category-keywords.ts` exporting `KEYWORDS: Map<string, string>` + `matchKeyword(merchant: string): string \| null` | Pre-match layer; **0 API calls** on hit. Seed covers Shell/YPF/Nafta→transporte, Spotify/Netflix/Cinemark→entretenimiento, Edesur/Personal/AySA→servicios, OSDE/SwissMedical/Farmacity→salud, MercadoLibre/Zara→compras, Coderhouse/Cuspide→educacion. |
| A2 | New `merchant_category_cache` table (PK on `merchant`), domain entity, `MerchantCachePort` (`findByMerchant` + `save`), Drizzle schema entry, `NeonDatabaseAdapter` methods | Persistence layer for previous categorization decisions. Hit → **0 API calls**. |
| A3 | `CategorizeTransactionUseCase` gains an auto-accept threshold: when `ranked[0].distance < ranked[1].distance * AUTO_ACCEPT_THRESHOLD` (default `0.5`), assign top-1 without `generateText` | Eliminates the LLM call when the embedding match is unambiguous. Only real ambiguity invokes `generateText`. |
| A4 | After successful categorization, persist to `merchant_category_cache` (best-effort — log warning on failure, do not fail the transaction). Embedding failure → fallback to keyword-only path; if no keyword match, assign the `otros` category with `status='CATEGORIZED'` (design decision: keep transactions recoverable; document in code comment). | Cache hardening; predictable behavior under Gemini 429. |

The use-case execution order becomes: **keyword → cache → embed + auto-accept → generateText (ambiguous only) → cache write (best-effort)**.

### Part B — Admin Category Management (scope reduced from original draft)

| ID | Deliverable | Outcome |
|----|-------------|---------|
| B1 | New `CreateCategoryUseCase` in `backend/src/application/use-cases/create-category.use-case.ts`. Constructor takes `database`, `categoryTableRef`, `llm`. Asserts admin via the new helper, INSERTs category with `embedding=null` (fast 201), then asynchronously computes `llm.embed(name + ' ' + slug)` and UPDATEs the row. Embedding failure logs warning, does not roll back the category. | Admins can create categories without redeploying; embedding is eventually consistent. |
| B2 | `POST /categories` branch in `backend/src/interfaces/http/categories.routes.ts`. Authenticated via existing JWT verifier. Requires `actor.role === 'admin'`. Returns `201` on success, `403` for non-admin, `409` if `slug` exists (pre-check `SELECT`). | API surface for B1. |
| B3 | **`assertIsAdmin(actor: Actor): void`** added to `backend/src/application/use-cases/authorization.ts`. The two existing inline checks at `CreateUserUseCase:21` and `ListUsersUseCase:12` are refactored to call it. **Intentionally reduced**: no changes to `users` table, no changes to `cognito-bootstrap`, no changes to `JwtVerifierAdapter`, no changes to `assertCanActAs`. The role remains Cognito-only. | Single source of truth for admin gating; behavior preserved (existing use-case tests stay green unmodified). |

## Scope

### In Scope

- Part A1–A4 (all four optimizer layers).
- Part B1–B3 (`CreateCategoryUseCase`, `POST /categories`, `assertIsAdmin` helper with refactor of the two existing inline checks).
- New Vitest tests covering: keyword hit, cache hit, auto-accept threshold path, generateContent-only-on-ambiguity, admin create, non-admin 403, slug uniqueness 409, embedding failure non-blocking, smoke test (5 transactions → ≤1 generateContent call).
- Refactor of the two existing inline admin checks to use `assertIsAdmin` (no behavior change).

### Out of Scope

- Frontend (Phase 6, deferred).
- `DELETE /categories`, `PATCH /categories`.
- LLM provider switch.
- Paid tier upgrade (Cognito billing, Gemini tier change).
- GitHub Actions CI.
- README updates.
- Any change to the `users` table schema, `cognito-bootstrap`, or `JwtVerifierAdapter` (role stays Cognito-only).

## Approach

1. **Keyword pre-match (A1)** is pure data — `KEYWORDS` map plus `matchKeyword()` that does a case-insensitive substring scan against `merchant`. No state, no IO. Called first in `CategorizeTransactionUseCase.execute()`.
2. **Merchant cache (A2)** is a new port and table. We extend `DatabasePort` consumers via `MerchantCachePort` (separate concern from the generic `DatabasePort`). The use case checks cache before any LLM call and writes back after a successful categorization. `merchant` is the natural primary key — collisions on near-duplicates (e.g., `Shell` vs `SHELL`) are handled by `LOWER()` normalization at write time.
3. **Auto-accept threshold (A3)** sits between the similarity query and `generateText`. If only one category has an embedding, the threshold trivially passes. If two exist and `ranked[1]` exists, the ratio gates the call. Default `0.5` is conservative (top-1 must be at least 2× closer than top-2).
4. **Cache hardening (A4)** wraps the cache write in `try/catch`; embedding failure falls back to keyword → `otros`. Documented inline so the next reader does not "fix" the fallback.
5. **`CreateCategoryUseCase` (B1)** is a thin wrapper: validate actor → assertIsAdmin → pre-check slug uniqueness → INSERT → fire-and-forget embedding update (await in tests via `vi.waitFor` style helper, not awaited in production).
6. **`POST /categories` (B2)** adds the POST branch alongside the existing GET. The existing `authenticate(event, deps.tokenVerifier)` call already injects the actor; we read `actor.role` and 403 via the new helper.
7. **`assertIsAdmin` (B3)** is a one-line addition to `authorization.ts`. `CreateUserUseCase:21` and `ListUsersUseCase:12` get refactored to import and call it. The existing use-case tests remain unchanged because the error message and throw shape are preserved.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Keywords match the wrong category (e.g., a generic merchant name overlaps with a brand) | Medium | `KEYWORDS` is a plain `Map` — easy to tune. Add a unit test for each entry in the seed; document override behavior. |
| Cache becomes stale when an admin renames a category | Low (rename is out of scope) | Document in code comment; future `DELETE`/`PATCH` work will need a cache invalidation hook. |
| Refactor of inline admin checks alters behavior in `CreateUserUseCase` / `ListUsersUseCase` | Low | Existing use-case tests must remain green without modification — they are the regression guard. The error message stays byte-identical. |
| Auto-accept threshold too aggressive → wrong category picked silently | Medium | Default `0.5` is conservative; add a unit test that verifies `generateText` IS called when the top-1/top-2 distance ratio is ≥ 0.5. Threshold is a single constant — easy to tune. |

## Acceptance Criteria

1. `CategorizeTransactionUseCase` test suite covers: keyword hit (0 `embed`, 0 `generateText`), cache hit (0 `embed`, 0 `generateText`), auto-accept threshold (1 `embed`, 0 `generateText`), ambiguity (1 `embed`, 1 `generateText`). All with mocked `LLMPort`.
2. `CreateCategoryUseCase` tested: admin creates → 201; non-admin → `ForbiddenError`; duplicate slug → uniqueness error; embedding failure → category still persists, warning logged.
3. `POST /categories` tested with admin and non-admin tokens (route handler unit test).
4. Smoke test: 5 transactions (Shell, YPF, Spotify, PedidosYa, OSDE) consume ≤ 1 `generateText` call total. Keyword + cache absorb the rest.
5. Existing 34 tests still pass + new tests for `CreateCategory` + new `CategorizeTransaction` paths.
6. `assertIsAdmin` helper is used in `CreateUserUseCase`, `ListUsersUseCase`, AND `CreateCategoryUseCase`. Single import, single source of truth.

## Rollback Plan

- **Part A**: revert the four commits in the categorizer PR. The `merchant_category_cache` table is additive; the migration is idempotent and forward-compatible (no category data is destroyed). Cache writes are best-effort, so removing the write path is a one-line revert.
- **Part B**: revert the `POST /categories` route addition and the `CreateCategoryUseCase` file. Drop the `assertIsAdmin` refactor as a single commit. No data loss; admin category creation was the only new surface.
- **No destructive deltas**: nothing in this change drops a column, a port, or a use case. Reverting restores prior behavior byte-for-byte.

## Open Questions

1. **Cache invalidation on category rename** — deferred to future work. Should we leave a TODO in `CreateCategoryUseCase` (and a future `UpdateCategoryUseCase`) noting that the cache must be cleared? Or omit and let the next change handle it?
2. **`otros` fallback semantics** — when embedding fails AND no keyword matches, the proposal assigns `otros` with `status='CATEGORIZED'`. Alternative: keep `status='PENDING'` for explicit re-triage. The proposal picks `CATEGORIZED` for predictability (the transaction never gets stuck), but a PENDING alternative is defensible. Confirm during spec phase.
3. **Cache `merchant` normalization** — should we `LOWER()` and trim on write, or trust callers? The current proposal normalizes at the use-case layer. Acceptable?
