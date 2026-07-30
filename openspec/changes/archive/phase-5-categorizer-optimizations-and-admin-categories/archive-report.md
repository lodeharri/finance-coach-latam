# Archive Report — phase-5-categorizer-optimizations-and-admin-categories

## Summary
Phase 5 of finance-coach-latam delivered admin-only category management and 3-tier categorization optimizations (keyword → merchant cache → auto-accept threshold). Completed across 4 chained PRs (stacked-to-main) with full test coverage and bounded review.

## Capabilities delivered (NEW)
- **authorization** — assertIsAdmin helper extracted from previously inline admin checks
  - REQ-AZ-002: assertIsAdmin throws 'Forbidden: admin role required' on non-admin
  - REQ-AZ-003: assertIsAdmin returns void on admin
- **admin-categories** — admin-only category creation via POST /categories
  - REQ-AC-001: Only admin can create (assertIsAdmin gate)
  - REQ-AC-002: Slug uniqueness → 409
  - REQ-AC-003: Category persists even if embedding fails
  - REQ-AC-004: Embedding is async (fire-and-forget after 201)
  - REQ-AC-005: Color validated as hex
- **transaction-categorization** — CategorizeTransactionUseCase rewrite
  - REQ-TC-001: Keyword pre-match
  - REQ-TC-002: Merchant cache short-circuit
  - REQ-TC-003: Embed + similarity
  - REQ-TC-004: Auto-accept threshold
  - REQ-TC-005: generateContent ambiguity resolver
  - REQ-TC-006: Cache write after categorization
  - REQ-TC-007: Embedding failure → status PENDING
  - REQ-TC-008: Cache write non-fatal
  - REQ-TC-009: Merchant normalization

## PRs merged (stacked-to-main)
- PR #1: assertIsAdmin + authorization tests + 2 prod gap fixes (visibility timeout, embedding 768-dim)
- PR #2: merchant_category_cache persistence layer
- PR #3: KEYWORDS + CategorizeTransactionUseCase rewrite + 9 new scenarios + 3 coverage-gap follow-ups
- PR #4: CreateCategoryUseCase + POST /categories route

## Test results
- Before: 34 tests passing
- After: 94 tests passing (+60)
- tsc --noEmit: clean

## Production LoC totals
- Slice 1 (assertIsAdmin + refactor): ~47 LoC
- Slice 2 (merchant_category_cache + port + adapter): ~62 LoC production
- Slice 3 (KEYWORDS + CategorizeTransactionUseCase rewrite): ~198 LoC production
- Slice 4 (CreateCategoryUseCase + POST /categories): ~142 LoC production
- Total production: ~449 LoC across 4 chained PRs

## Bounded review evidence
- Lineage: review-5643d1ce96fbac42
- Lens: review-reliability (1 lens, standard diff)
- Risk: medium
- Findings: 1 WARNING + 2 SUGGESTION (all informational, no blockers)
- Validate gates (pre-commit, post-apply): result=allow
- Receipt sha256: stored in .git/gentle-ai/review-transactions/v2/review-5643d1ce96fbac42/

## Files created/modified
- backend/src/application/use-cases/authorization.ts (+6)
- backend/src/application/use-cases/authorization.test.ts (new, +35)
- backend/src/application/use-cases/create-user.use-case.ts (refactored to assertIsAdmin)
- backend/src/application/use-cases/create-user.use-case.test.ts (+1/-1)
- backend/src/application/use-cases/list-users.use-case.ts (refactored)
- backend/src/application/use-cases/list-users.use-case.test.ts (+1/-1)
- backend/src/domain/ports/merchant-cache.port.ts (new)
- backend/src/infrastructure/database/drizzle/schema.ts (+merchantCategoryCacheTable)
- backend/drizzle/0003_merchant_category_cache.sql (new)
- backend/drizzle/meta/{0003_snapshot.json,_journal.json} (updated)
- backend/src/infrastructure/database/merchant-cache.adapter.ts (new)
- backend/src/infrastructure/database/merchant-cache.adapter.test.ts (new, +79)
- backend/src/lambdas/api/composition.ts (+MerchantCacheAdapter + CreateCategoryUseCase)
- backend/src/lambdas/categorizer/composition.ts (+MerchantCacheAdapter)
- backend/src/domain/keywords/category-keywords.ts (new, +46)
- backend/src/domain/keywords/category-keywords.test.ts (new, +90)
- backend/src/application/use-cases/categorize-transaction.use-case.ts (rewrite, +126/-4)
- backend/src/application/use-cases/categorize-transaction.use-case.test.ts (+458/-36)
- backend/src/application/use-cases/create-category.use-case.ts (new, +75)
- backend/src/application/use-cases/create-category.use-case.test.ts (new, +170)
- backend/src/interfaces/http/categories.routes.ts (POST branch, +51/-5)
- backend/src/interfaces/http/categories.routes.test.ts (new, +240)
- backend/src/interfaces/http/api.routes.ts (+2)
- openspec/config.yaml (new)
- openspec/specs/{authorization,admin-categories,transaction-categorization}/spec.md (new)

## Out of scope (deferred)
- DELETE /categories, PATCH /categories
- Frontend (still placeholder)
- GitHub Actions CI workflow
- README updates for the new architecture
- Cache invalidation on future category rename (TODO in CreateCategoryUseCase)
- LLM provider switch (Gemini → OpenAI)
- Paid Gemini tier upgrade

## Closed commits
Total commits across the change: 19 (4 merge commits + 15 feature commits, plus 1 chore for openspec artifacts)