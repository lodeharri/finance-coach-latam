# Design: Categorizer Optimizations and Admin Category Management

## Technical Approach

Reduce Gemini API usage by inserting three short-circuit layers (keyword, merchant cache, auto-accept threshold) before the existing embedding + LLM ambiguity path, and add a third admin-only path (`POST /categories`) backed by `CreateCategoryUseCase`. Extract the two duplicated inline admin checks into `assertIsAdmin(actor)`. PERSIST the merchant cache as a new additive table; do NOT alter the categories schema, do NOT alter the `users` table, do NOT alter `JwtVerifierAdapter`.

## 1. Architecture Overview

New categorization pipeline (ASCII sequence diagram):

```
CategorizeTransactionUseCase.execute(input)
  |
  |---- assertCanActAs(actor, userId) ---------------------- throw on mismatch
  |
  |---- SELECT transaction WHERE id, userId ----------------- throw "Transaction not found" if missing
  |
  |---- normalized = normalize(transaction.merchant)        // LOWER + TRIM + collapse whitespace
  |
  |==== KEYWORD LAYER (REQ-TC-001) =========================
  |  keywordSlug = matchKeyword(normalized);
  |  if (keywordSlug) {
  |    categoryId = lookupCategoryIdBySlug(keywordSlug);
  |    if (categoryId) -> write(TRANSACTION, { categoryId, status: 'CATEGORIZED' });
  |                       -> writeCACHE(normalized, categoryId);   // best-effort
  |                       -> RETURN;
  |  }
  |
  |==== CACHE LAYER (REQ-TC-002) ============================
  |  cached = await merchantCache.findByMerchant(normalized);
  |  if (cached) {
  |    -> write(TRANSACTION, { categoryId: cached.categoryId, status: 'CATEGORIZED' });
  |    -> RETURN;              // no cache write-back (already exists)
  |  }
  |
  |==== EMBEDDING LAYER (REQ-TC-003) ========================
  |  try {
  |    vector = await llm.embed(merchant + ' ' + notes);
  |    ranked = await database.query(SIMILAR_SQL, [JSON.stringify(vector)]);
  |    if (ranked.length === 0) throw new Error('No categories are available');
  |  } catch (embedErr) {
  |    -> write(TRANSACTION, { status: 'PENDING' });           // REQ-TC-007
  |    -> RETURN;            // no throw, no LLM call, no cache write
  |  }
  |
  |==== AUTO-ACCEPT THRESHOLD (REQ-TC-004) ==================
  |  if (ranked.length === 1 ||
  |      ranked[0].distance < ranked[1].distance * 0.5) {
  |    -> write(TRANSACTION, { categoryId: ranked[0].id, status: 'CATEGORIZED' });
  |    -> writeCACHE(normalized, ranked[0].id);                // best-effort
  |    -> RETURN;
  |  }
  |
  |==== LLM AMBIGUITY (REQ-TC-005) ===========================
  |  suggestion = await llm.generateText(rankedPrompt);
  |  selected = ranked.find(c => suggestion.includes(c.id));
  |  if (!selected) throw new Error('LLM returned an unknown category');
  |
  |==== WRITE (any successful path, REQ-TC-006) ==============
  |  updated = await database.update(TRANSACTION, ...);
  |  try { await merchantCache.save(normalized, selected.id); }
  |    catch (cacheErr) { console.warn('cache write failed', normalized, cacheErr); }
  |  RETURN updated;
```

## 2. New Domain Layer

### Decision: `MerchantCachePort` is a separate port

**Choice**: New `MerchantCachePort` interface in `backend/src/domain/ports/merchant-cache.port.ts`. NOT a method on `DatabasePort`.
**Alternatives considered**: Adding `findByMerchant` / `save` directly to `DatabasePort` (rejected — `DatabasePort` is generic CRUD; cache is a domain-specific concern). Using `database.query` with raw SQL (rejected — leaks SQL across use case; cache is not raw SQL infrastructure).
**Rationale**: Use case depends on a semantic port (`MerchantCachePort`) with two methods. The Neon adapter implements it via `NeonDatabaseAdapter`, keeping the domain layer free of Drizzle SQL.

```typescript
// backend/src/domain/ports/merchant-cache.port.ts
export interface MerchantCachePort {
  findByMerchant(merchant: string): Promise<{ categoryId: string } | null>;
  save(merchant: string, categoryId: string): Promise<void>;
}
```

### Keyword map and pure matcher

```typescript
// backend/src/domain/keywords/category-keywords.ts
export const KEYWORDS: ReadonlyMap<string, string> = new Map<string, string>([
  ['shell', 'transporte'], ['ypf', 'transporte'], ['nafta', 'transporte'],
  ['spotify', 'entretenimiento'], ['netflix', 'entretenimiento'], ['cinemark', 'entretenimiento'],
  ['edesur', 'servicios'], ['personal', 'servicios'], ['aysa', 'servicios'],
  ['osde', 'salud'], ['swissmedical', 'salud'], ['farmacity', 'salud'],
  ['mercadolibre', 'compras'], ['zara', 'compras'],
  ['coderhouse', 'educacion'], ['cuspide', 'educacion'],
]);
export function matchKeyword(merchant: string): string | null;
```

`matchKeyword` lower-cases `merchant`, then iterates `KEYWORDS` keys and returns the slug on the first substring match. Pure function, no IO.

### `Actor` and `assertIsAdmin`

`Actor` already exists in `authorization.ts`. Add:

```typescript
export function assertIsAdmin(actor: Actor): void {
  if (actor.role !== 'admin') {
    throw new Error('Forbidden: admin role required');
  }
}
```

Mirrors the existing `assertCanActAs` style. Throws `Error` whose message contains `'Forbidden'` so `routeError()` in `http.utils.ts:95` already maps it to HTTP 403.

## 3. Modified Use Cases

### `CategorizeTransactionUseCase` — new constructor + flow

**File**: `backend/src/application/use-cases/categorize-transaction.use-case.ts`
**New constructor signature** (4 args):

```typescript
constructor(
  private readonly database: DatabasePort,
  private readonly llm: LLMPort,
  private readonly transactionTableRef: TableRef<Transaction>,
  private readonly merchantCachePort: MerchantCachePort,
) {}
```

**New module-level constant**:

```typescript
const AUTO_ACCEPT_THRESHOLD = 0.5;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/; // not used here; document for CreateCategory
```

**New private helper** (called at the top of `execute()`):

```typescript
private normalize(merchant: string): string {
  return merchant.trim().replace(/\s+/g, ' ').toLowerCase();
}
```

The body of `execute()` is rewritten per the ASCII diagram in Section 1. Key contract details:

- **Keyword layer** requires looking up `categoryId` from `slug`. Reuse the existing `database.select(categoryTableRef, { where: { slug }, limit: 1 })`. If missing (shouldn't happen with the seed), skip to cache layer.
- **Cache layer** calls `this.merchantCachePort.findByMerchant(normalized)`. Cache hit returns immediately; cache writes are best-effort reserved for the embedding path (cache already exists for the merchant).
- **Embedding layer** retains the existing `SIMILAR_SQL` and `queryRankedCategories` helper. The zero-rows branch throws `'No categories are available'`.
- **Embedding failure branch** (REQ-TC-007): wraps `llm.embed` in a `try`/`catch`. On rejection, calls `database.update(transactionTableRef, { id, userId }, { status: 'PENDING' })` with no `categoryId`, then returns. No `database.query` runs, no `merchantCachePort.save`, no throw.
- **Auto-accept threshold** (REQ-TC-004): the expression is `ranked[0].distance < ranked[1].distance * AUTO_ACCEPT_THRESHOLD`. When `ranked.length === 1`, the threshold trivially passes (no `ranked[1]`).
- **LLM ambiguity** (REQ-TC-005): prompt is unchanged from the existing implementation. The `suggestion.includes(category.id)` matching is preserved.
- **Cache write** (REQ-TC-006, REQ-TC-008): `try { await this.merchantCachePort.save(normalized, selected.id); } catch (err) { console.warn('merchant cache write failed', { merchant: normalized, err }); }` — logged but not thrown.

### `CreateCategoryUseCase` — new class

**File**: `backend/src/application/use-cases/create-category.use-case.ts`

```typescript
export interface CreateCategoryInput {
  readonly actor: Actor;
  readonly slug: string;
  readonly name: string;
  readonly color: string;
  readonly icon?: string;
}

export class CreateCategoryUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly categoryTableRef: TableRef<Category>,
    private readonly llm: LLMPort,
  ) {}

  async execute(input: CreateCategoryInput): Promise<Category> {
    assertIsAdmin(input.actor);                                  // REQ-AC-001
    if (!/^#[0-9A-Fa-f]{6}$/.test(input.color)) {
      throw new Error('Field "color" must be a hex color like #AABBCC');
    }
    const existing = await this.database.select(this.categoryTableRef, {
      where: { slug: input.slug },
      limit: 1,
    });
    if (existing.length > 0) {
      throw new Error(`Category slug already exists: ${input.slug}`);  // REQ-AC-002
    }
    const inserted = await this.database.insert(this.categoryTableRef, {
      slug: input.slug,
      name: input.name,
      color: input.color,
    });
    // REQ-AC-004: fire-and-forget embedding. Do NOT await here.
    void this.persistEmbedding(inserted.id, input.name, input.slug);
    return inserted;
  }

  private async persistEmbedding(id: string, name: string, slug: string): Promise<void> {
    try {
      const embedding = await this.llm.embed(`${name} ${slug}`);    // REQ-AC-003
      await this.database.update(this.categoryTableRef, { id }, { embedding });
    } catch (err) {
      console.warn('category embedding failed', { id, slug, err });
    }
  }
}
```

Note: `persistenceEmbedding` is `void`-ed because REQ-AC-004 mandates the row returns before the embedding completes. The `pgvector` similarity query already filters `WHERE embedding IS NOT NULL` (REQ-AC-004 second scenario).

### `CreateUserUseCase` and `ListUsersUseCase` refactor

Replace the inline `if (input.actorRole !== 'admin') throw new Error('Forbidden: ...')` with `assertIsAdmin({ userId: 'system', role: input.actorRole })`. The existing call sites keep `actorRole: UserRole` and construct an `Actor` on the fly because the use case contracts are not refactored to take a full `Actor`. The error message becomes `Forbidden: admin role required` (unified). This is the ONLY test-breaking change in the refactor — see Section 8.

## 4. New Persistence

### `merchant_category_cache` table

**Drizzle entry** in `backend/src/infrastructure/database/drizzle/schema.ts`:

```typescript
export const merchantCategoryCacheTable = pgTable('merchant_category_cache', {
  merchant: text('merchant').primaryKey(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categoryTable.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type MerchantCategoryCacheRow = typeof merchantCategoryCacheTable.$inferSelect;
export type MerchantCategoryCacheInsert = typeof merchantCategoryCacheTable.$inferInsert;
```

### SQL (migration `0003_merchant_category_cache.sql`)

```sql
CREATE TABLE IF NOT EXISTS "merchant_category_cache" (
  "merchant" text PRIMARY KEY NOT NULL,
  "category_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "merchant_category_cache"
    ADD CONSTRAINT "merchant_category_cache_category_id_categories_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
```

Numbering: `0002_eager_stellaris.sql` is the last applied. New file is `0003_merchant_category_cache.sql`. `drizzle-kit generate` produces it; the `_journal.json` and snapshot files are appended automatically by the generator.

### `NeonDatabaseAdapter` additions

Two new methods on `NeonDatabaseAdapter`, both implemented via the existing `database.query` escape hatch:

```typescript
async findByMerchant(merchant: string): Promise<{ categoryId: string } | null> {
  const rows = await this.database.query<{ category_id: string }>(
    'SELECT category_id FROM merchant_category_cache WHERE merchant = $1 LIMIT 1',
    [merchant],
  );
  return rows[0] ? { categoryId: rows[0].category_id } : null;
}

async save(merchant: string, categoryId: string): Promise<void> {
  await this.database.query(
    'INSERT INTO merchant_category_cache (merchant, category_id) VALUES ($1, $2) ON CONFLICT (merchant) DO NOTHING',
    [merchant, categoryId],
  );
}
```

`ON CONFLICT DO NOTHING` (REQ mentioned in Open Risks) makes the write idempotent under concurrent transactions for the same merchant.

A thin port implementation wraps both methods:

```typescript
// backend/src/infrastructure/cache/merchant-cache.adapter.ts
export class MerchantCacheAdapter implements MerchantCachePort {
  constructor(private readonly database: DatabasePort) {}
  findByMerchant(merchant: string) { return this.database.findByMerchant(merchant); }
  save(merchant: string, categoryId: string) { return this.database.save(merchant, categoryId); }
}
```

The adapter is required so the composition root can inject `MerchantCachePort` (the use case depends on the port, not the adapter). The adapter is a one-method passthrough to keep the domain port SQL-free.

## 5. Modified HTTP Routes

### `POST /categories` handler

**File**: `backend/src/interfaces/http/categories.routes.ts`

```typescript
export interface CategoriesRoutesDeps {
  readonly tokenVerifier: TokenVerifierPort;
  readonly listCategoriesUseCase: ListCategoriesUseCase;
  readonly createCategoryUseCase: CreateCategoryUseCase;       // NEW
}

export function createCategoriesRoutes(deps: CategoriesRoutesDeps): HttpRouteHandler {
  return async (event) => {
    try {
      const actor = await authenticate(event, deps.tokenVerifier);
      const method = event.requestContext.http.method;
      if (method === 'GET') {
        return jsonResponse(200, await deps.listCategoriesUseCase.execute());
      }
      if (method === 'POST') {
        const body = parseBody(event);
        const created = await deps.createCategoryUseCase.execute({
          actor,
          slug: requiredString(body, 'slug'),
          name: requiredString(body, 'name'),
          color: requiredString(body, 'color'),
        });
        return jsonResponse(201, created);
      }
      throw new HttpError(405, `Method ${method} is not allowed on /categories`);
    } catch (error) {
      return routeError(error);
    }
  };
}
```

Admin gating happens inside `CreateCategoryUseCase.execute` via `assertIsAdmin`. The use case throws `Error('Forbidden: admin role required')`; `routeError()` already maps the `'Forbidden:'` prefix to HTTP 403. The route also relies on the existing `requiredString` helper for 400 validation.

### Route wiring

`api.routes.ts` MUST gain the `createCategoryUseCase` dep and forward it to `createCategoriesRoutes`. `api/composition.ts` MUST instantiate `CreateCategoryUseCase(database, categoryTableRef, llm)` and pass it through.

### Tests for `/categories` admin gate

- Admin token + valid payload → 201, body equals the inserted row.
- Non-admin token → 403, body `{ error: 'Forbidden: admin role required' }`, `database.insert` not called.
- Admin token + duplicate `slug` → 409 via `routeError` mapping `routeError` keeps the underlying message (the `Error` thrown by the use case starts with the slug, not `'Forbidden'`). For 409 to map correctly we explicitly throw `new HttpError(409, ...)` from the route when the use case's error message starts with `'Category slug already exists'`. (See Section 7.)

## 6. Composition Root Wiring

### Categorizer bundle (`backend/src/lambdas/categorizer/composition.ts`)

```typescript
import { MerchantCacheAdapter } from '../../infrastructure/cache/merchant-cache.adapter';
import { KEYWORDS } from '../../domain/keywords/category-keywords';

const database = new NeonDatabaseAdapter(config.databaseUrl);
const llm = createLLMProvider(config.llm);
const merchantCache = new MerchantCacheAdapter(database);

const categorizeTransactionUseCase = new CategorizeTransactionUseCase(
  database, llm, transactionTableRef, merchantCache,
);
```

`KEYWORDS` is imported transitively via `CategorizeTransactionUseCase` → the use case imports `matchKeyword` from `domain/keywords/category-keywords.ts`. esbuild resolves the import graph and pulls the module into the categorizer bundle. No `esbuild.config.mjs` change needed.

### API bundle (`backend/src/lambdas/api/composition.ts`)

```typescript
const llm = createLLMProvider(config.llm);                                 // already exists
const merchantCache = new MerchantCacheAdapter(database);                 // NEW
const createCategoryUseCase = new CreateCategoryUseCase(                 // NEW
  database, categoryTableRef, llm,
);
const categorizeTransactionUseCase = new CategorizeTransactionUseCase(
  database, llm, transactionTableRef, merchantCache,                       // NEW 4th arg
);
```

Justification: `CategorizeTransactionUseCase` is also wired into the API bundle for the `POST /transactions/{id}/categorize` route. The same instance is fine — `CategorizeTransactionUseCase` is request-scoped (no mutable state). `MerchantCacheAdapter` is wired in BOTH composition roots because the API path can also trigger categorization.

### What `KEYWORDS` does NOT do

The API bundle does NOT call `matchKeyword` directly. The `KEYWORDS` module is referenced only through `CategorizeTransactionUseCase`. The bundle includes the module as a transitive dependency of the use case — but the use case is only instanced for the categorize endpoint. The keyword map is small (~16 entries) and adding ~1 KB to the API bundle is acceptable. We do NOT isolate KEYWORDS into a separate file to keep the change reviewable.

## 7. Error Handling

### Decision: error taxonomy

| Error location | Thrown value | Mapped to HTTP |
|---|---|---|
| `CreateCategoryUseCase` non-admin | `Error('Forbidden: admin role required')` | 403 (via `routeError`'s `'Forbidden:'` prefix) |
| `CreateCategoryUseCase` duplicate slug | `Error('Category slug already exists: <slug>')` | **Route catches this and re-throws `HttpError(409, ...)`** |
| `CreateCategoryUseCase` invalid color | `Error('Field "color" must be a hex color like #AABBCC')` | 500 (fall-through) — design calls for the route to pre-validate `^#[0-9A-Fa-f]{6}$` and throw `HttpError(400)` so the use case never runs. |
| `CategorizeTransactionUseCase` transaction not found | `Error('Transaction not found')` | 404 (via `routeError`'s `'not found'` substring) |
| `CategorizeTransactionUseCase` no categories | `Error('No categories are available')` | 500 |
| `CategorizeTransactionUseCase` LLM unknown id | `Error('LLM returned an unknown category')` | 500 |
| `CategorizeTransactionUseCase` embedding failure | (no throw) | 200 with `status: 'PENDING'` |
| `CategorizeTransactionUseCase` cache write failure | (no throw, `WARN` logged) | 200 |

The route handler for `POST /categories` performs regex pre-validation on `color` and throws `HttpError(400)`. The use case's own regex check is a defense-in-depth backstop.

### `routeError()` mapping for slug duplicate

The route handler above intercepts the use case's thrown error by re-throwing as `HttpError(409)`:

```typescript
try {
  ...
} catch (error) {
  if (error instanceof Error && error.message.startsWith('Category slug already exists')) {
    return routeError(new HttpError(409, error.message));
  }
  return routeError(error);
}
```

This keeps the route handler small while still surfacing the right HTTP status.

### Forbidden error message unification

The unified error message is `'Forbidden: admin role required'`. This replaces:
- `'Forbidden: only admins can create users'` (CreateUserUseCase)
- `'Forbidden: only admins can list users'` (ListUsersUseCase)

Both replaced lines become `assertIsAdmin({ userId: 'system', role: input.actorRole })`. The 2 existing test assertions must change to match (see Section 8).

## 8. Test Strategy

### New tests

| File | Coverage |
|---|---|
| `backend/src/domain/keywords/category-keywords.test.ts` | `matchKeyword` returns expected slug for each seed merchant; returns `null` for unknown; case-insensitive. |
| `backend/src/application/use-cases/categorize-transaction.use-case.test.ts` (extend) | (a) keyword hit — 0 `embed`, 0 `generateText`, 1 `update`; (b) cache hit — 0 `embed`, 0 `generateText`; (c) auto-accept single row — 1 `embed`, 0 `generateText`; (d) auto-accept ratio < 0.5 — 0 `generateText`; (e) ambiguity ratio ≥ 0.5 — 1 `generateText`; (f) embedding failure + no keyword — 1 `update` with `status: 'PENDING'`, no `generateText`, no throw; (g) embedding failure + keyword match — keyword path wins, 0 LLM calls; (h) cache write failure — 1 `update`, warns, returns the updated transaction; (i) smoke test — 5 transactions (Shell/YPF/Spotify/PedidosYa/OSDE) consume ≤ 1 `generateText` total. |
| `backend/src/application/use-cases/create-category.use-case.test.ts` | (a) admin creates → returns row, `database.insert` with `embedding` not set; (b) non-admin 403 with `'Forbidden'`; (c) duplicate slug → throws `'Category slug already exists: <slug>'`; (d) invalid color → throws referencing `color`; (e) embedding failure → row persists, `WARN` logged with id; (f) create returns before embedding resolves (mock `llm.embed` returns a never-resolving promise, `execute` still resolves). |
| `backend/src/interfaces/http/categories.routes.test.ts` | (a) `GET` returns 200; (b) `POST` admin → 201; (c) `POST` non-admin → 403 with `'Forbidden: admin role required'`; (d) `POST` duplicate slug → 409; (e) `POST` invalid color → 400. |
| `backend/src/application/use-cases/authorization.test.ts` | (a) `assertIsAdmin` admin returns void; (b) non-admin throws `'Forbidden'`; (c) `assertCanActAs` retains existing semantics (smoke test, no behavior change). |

### Existing test changes (required)

| File | Line | From | To |
|---|---|---|---|
| `backend/src/application/use-cases/create-user.use-case.test.ts` | 93 | `rejects.toThrow('Forbidden: only admins can create users')` | `rejects.toThrow('Forbidden: admin role required')` |
| `backend/src/application/use-cases/list-users.use-case.test.ts` | 38 | `rejects.toThrow('Forbidden: only admins can list users')` | `rejects.toThrow('Forbidden: admin role required')` |

This is the explicit test-update call-out from the proposal and Section 11 of this design. The semantic contract (rejection happens, no DB call) is preserved.

### Composition

- Total new test count: ~25 new scenarios (estimated) + 2 modified existing assertions.
- The 4 existing `CategorizeTransactionUseCase` tests (`uses pgvector`, `fails when transaction not found`, `fails when no categories`, `rejects unknown category`) remain green. The `uses pgvector` test continues to exercise the embedding + LLM path on a transaction whose merchant is `'Shell'` and must continue to assert `embed` is called. **The test must be updated** to mock `matchKeyword` so Shell does NOT short-circuit (the new keyword map maps `'shell'` to `'transporte'`). Solution: change the test transaction's merchant to `'PedidosYa'` (no keyword) so the existing embedding + LLM path still runs. This is an additional in-test change.

## 9. Migration Path

### Forward-only

- `0003_merchant_category_cache.sql` is additive. No data backfill: the cache populates organically as `CategorizeTransactionUseCase` runs and writes back successful categorizations.
- `merchant_category_cache` carries no application data loss risk on migration failure: `CREATE TABLE IF NOT EXISTS` (consistent with `0000_known_shaman.sql` style) and the FK constraint uses `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null;` (consistent with `0001_youthful_salo.sql`).
- New `merchant_category_cache` table is created but unused by the categorizer before the new code is deployed. The migration is safe to apply independently of the code change.

### Rollback

- Forward: the migration applies once at deploy time.
- Backward: the categorizer PR's commits revert in reverse. Drop the migration by manual `DROP TABLE merchant_category_cache`. No data loss because the cache is regeneratable.
- The cache write is best-effort (REQ-TC-008): removing the write path is a one-line revert in the use case.

## 10. Out of Scope Reminder

Frontend (Phase 6), `DELETE /categories`, `PATCH /categories`, LLM provider switch, paid tier (Cognito/Gemini), GitHub Actions CI, README updates, `users` table changes, `cognito-bootstrap` changes, `JwtVerifierAdapter` changes — none of these are touched by this change.

## 11. Open Risks

| Risk | Status | Mitigation |
|---|---|---|
| The 2 refactored inline admin checks change error message strings. | NEW (design-level) | Listed in Section 8. Two existing test assertions MUST be updated. The semantic contract is preserved. |
| Cache writes race for the same merchant under concurrent transactions. | NEW (design-level) | `ON CONFLICT (merchant) DO NOTHING` on the cache INSERT — idempotent. The transactions themselves lock on `(id, userId)` via the existing `update` call. |
| `KEYWORDS` is module-level and evaluated at import time. If a category is renamed, `KEYWORDS` could point to a stale slug. | NEW (design-level) | `matchKeyword` returns a slug; the use case then SELECTs the category by slug. If the slug is missing, the keyword layer returns `null` (no crash) and execution falls through to the cache layer. No automatic invalidation is needed because new categories are additive and slug renames are out of scope. |
| `CategorizeTransactionUseCase` constructor signature change (4th arg) breaks the API composition. | NEW (design-level) | Both composition roots are updated in the same PR. Tests are updated in the same commit. |
| `CreateCategoryUseCase` POST returns 201 before embedding is computed; the caller may call `POST /transactions/{id}/categorize` immediately and find the new category missing from the similarity results. | carried forward from proposal | Documented in the spec (REQ-AC-004 second scenario). The similarity query already filters `WHERE embedding IS NOT NULL`. A retry later will pick the new category up. |
| `assertIsAdmin` does not check `actor.userId` non-empty. | NEW (design-level) | Out of scope. The existing `assertCanActAs` does not check it either; a malformed token is caught upstream by `authenticate()`. |
| Auto-accept threshold (0.5) is too aggressive for some categories. | carried forward | Section 1's `AUTO_ACCEPT_THRESHOLD` constant is module-level — a single edit tunes it. Tests assert the boundary at 0.5. |
| `icon` field in `CreateCategoryInput` is not declared in the categories table. | NEW (design-level) | The schema column for `icon` does not exist. Drop `icon` from `CreateCategoryInput` — the spec only requires `slug`, `name`, `color`. (Spec lists `icon` in the payload but the schema has no such column. Treat `icon` as optional-with-no-side-effect and ignore it in the route handler. The use case signature itself does not include `icon`.) |

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/domain/ports/merchant-cache.port.ts` | Create | New port interface. |
| `backend/src/domain/keywords/category-keywords.ts` | Create | `KEYWORDS` map + `matchKeyword`. |
| `backend/src/application/use-cases/authorization.ts` | Modify | Add `assertIsAdmin(actor)`. |
| `backend/src/application/use-cases/create-category.use-case.ts` | Create | New use case. |
| `backend/src/application/use-cases/categorize-transaction.use-case.ts` | Modify | Add 4th constructor arg, rewrite `execute()`, normalize merchant. |
| `backend/src/application/use-cases/create-user.use-case.ts` | Modify | Replace inline check with `assertIsAdmin`. |
| `backend/src/application/use-cases/list-users.use-case.ts` | Modify | Replace inline check with `assertIsAdmin`. |
| `backend/src/infrastructure/cache/merchant-cache.adapter.ts` | Create | Adapter implementing `MerchantCachePort`. |
| `backend/src/infrastructure/database/drizzle/schema.ts` | Modify | Add `merchantCategoryCacheTable` + typed refs. |
| `backend/src/infrastructure/database/neon-database.adapter.ts` | Modify | Add `findByMerchant` + `save` methods (via `query`). |
| `backend/src/interfaces/http/categories.routes.ts` | Modify | Add `POST` branch. |
| `backend/src/interfaces/http/api.routes.ts` | Modify | Forward `createCategoryUseCase`. |
| `backend/src/lambdas/api/composition.ts` | Modify | Instantiate `MerchantCacheAdapter`, `CreateCategoryUseCase`, pass 4th arg to `CategorizeTransactionUseCase`. |
| `backend/src/lambdas/categorizer/composition.ts` | Modify | Instantiate `MerchantCacheAdapter`, pass 4th arg. |
| `backend/drizzle/0003_merchant_category_cache.sql` | Create | New migration. |
| `backend/src/application/use-cases/categorize-transaction.use-case.test.ts` | Modify | Existing `uses pgvector` test changes merchant to `'PedidosYa'`. Add new scenarios. |
| `backend/src/application/use-cases/create-user.use-case.test.ts` | Modify | Update error message assertion. |
| `backend/src/application/use-cases/list-users.use-case.test.ts` | Modify | Update error message assertion. |
| `backend/src/application/use-cases/create-category.use-case.test.ts` | Create | New test file. |
| `backend/src/interfaces/http/categories.routes.test.ts` | Create | New test file. |
| `backend/src/application/use-cases/authorization.test.ts` | Create | New test file. |
| `backend/src/domain/keywords/category-keywords.test.ts` | Create | New test file. |

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `matchKeyword` (each seed entry, unknown merchant, case-insensitive). `assertIsAdmin` (admin returns, non-admin throws). `CategorizeTransactionUseCase` (9 scenarios). `CreateCategoryUseCase` (6 scenarios). | Vitest with `vi.fn()` mocks for `DatabasePort`, `LLMPort`, `MerchantCachePort`. |
| Integration | `POST /categories` admin/non-admin/duplicate/invalid-color happy and error paths. | Vitest route handler tests in `backend/src/interfaces/http/categories.routes.test.ts` with manual `APIGatewayProxyEventV2` fixtures. |
| Smoke | 5 transactions with mocked ports → `generateText` called ≤ 1. | Single Vitest scenario in `categorize-transaction.use-case.test.ts`. |

## Threat Matrix

N/A — this change does not add routing beyond `POST /categories` (which uses the existing `categories.routes.ts` pattern), no shell command, no subprocess, no VCS automation, no executable-file classification, and no new process integration. The `MerchantCachePort` is an in-process domain port; `NeonDatabaseAdapter.query` is the existing SQL escape hatch.

## Migration / Rollout

No feature flags. The change deploys as a single PR (Part A + Part B bundled per the proposal) with the migration in `0003_merchant_category_cache.sql`. Rollback is per-commit (see Section 9).

## Open Questions

None — all three proposal open questions were resolved in the spec phase (Locked Design Decisions in `spec.md`).
