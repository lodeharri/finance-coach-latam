# Design: Categories CRUD — PATCH and DELETE

## Technical Approach

Close the admin `/categories` CRUD loop with two new use cases (`UpdateCategoryUseCase`, `DeleteCategoryUseCase`), two new HTTP branches (PATCH/DELETE on `/categories/{id}`), and one new port method (`MerchantCachePort.invalidateByCategoryId`). Mirrors the existing `CreateCategoryUseCase` patterns: `assertIsAdmin` gate, `database.select`/`update`/`delete` for CRUD, raw SQL via `database.query` for the out-of-entity `embedding` column, fire-and-forget embedding recompute, and best-effort cache cleanup with `try/catch` + `console.warn`. Maps to REQ-AC-006, REQ-AC-007, REQ-AC-008 (existing capability `admin-categories` extended).

## 1. Module Boundaries

| File | Action | Description |
|------|--------|-------------|
| `backend/src/application/use-cases/update-category.use-case.ts` | Create | PATCH logic: select, validate, update, fire-and-forget embed, invalidate cache |
| `backend/src/application/use-cases/update-category.use-case.test.ts` | Create | 7 scenarios (see §6) |
| `backend/src/application/use-cases/delete-category.use-case.ts` | Create | DELETE logic: select, invalidate cache, delete with FK error mapping |
| `backend/src/application/use-cases/delete-category.use-case.test.ts` | Create | 5 scenarios (see §6) |
| `backend/src/domain/ports/merchant-cache.port.ts` | Modify | Add `invalidateByCategoryId(categoryId): Promise<void>` abstract method |
| `backend/src/infrastructure/database/merchant-cache.adapter.ts` | Modify | Implement `invalidateByCategoryId` via `DELETE FROM merchant_category_cache WHERE category_id = $1` |
| `backend/src/infrastructure/database/merchant-cache.adapter.test.ts` | Modify | Add 1 scenario for `invalidateByCategoryId` |
| `backend/src/domain/ports/database.port.ts` | Modify | Add `delete<TEntity>(table, where): Promise<void>` (mirrors `update`) |
| `backend/src/infrastructure/database/neon-database.adapter.ts` | Modify | Implement `delete` via Drizzle `.delete().where(...).returning()` |
| `backend/src/interfaces/http/categories.routes.ts` | Modify | Add PATCH (`/categories/{id}`) and DELETE (`/categories/{id}`) branches; extend `CategoriesRoutesDeps` |
| `backend/src/interfaces/http/categories.routes.test.ts` | Modify | Add PATCH + DELETE route tests |
| `backend/src/interfaces/http/api.routes.ts` | Modify | Dispatch `/categories/{id}` (single segment) to `createCategoriesRoutes` |
| `backend/src/interfaces/http/http.utils.ts` | Modify | Extend CORS `Allow-Methods` to `GET,POST,PATCH,DELETE,OPTIONS` |
| `backend/src/lambdas/api/composition.ts` | Modify | Wire the two new use cases into `createApiRoutes` deps |

## 2. New Use Cases

### `UpdateCategoryUseCase`

```ts
export interface UpdateCategoryPatch {
  readonly name?: string;
  readonly color?: string;
  // slug is intentionally NOT updatable (REQ-AC-006 + proposal Locked Decision)
}

export interface UpdateCategoryInput {
  readonly actor: Actor;
  readonly id: string;
  readonly patch: UpdateCategoryPatch;
}

class UpdateCategoryUseCase {
  constructor(
    database: DatabasePort,
    categoryTableRef: TableRef<Category>,
    llm: LLMPort,
    merchantCache: MerchantCachePort,
  ) {}

  async execute(input: UpdateCategoryInput): Promise<Category>
}
```

**Flow** (mirrors `CreateCategoryUseCase.execute`):
1. `assertIsAdmin(input.actor)` → throws plain `Error('Forbidden: admin role required')` (caught by `routeError` → 403)
2. If `input.patch.color` is present, validate `HEX_COLOR` regex → throws `Error('Field "color" must be a hex color like #AABBCC')` (defense-in-depth)
3. `database.select(categoryTableRef, { where: { id: input.id }, limit: 1 })` → if empty, throw `Error('Category not found')` (routeError maps `not found` → 404)
4. `database.update(categoryTableRef, { id: input.id }, { ...non-undefined patch fields })` → returns updated row
5. **Embedding recompute (conditional)**: only when `patch.name` is provided. `void this.persistEmbedding(updated.id, updated.name, existing.slug)` — same `database.query(UPDATE_EMBEDDING_SQL, …)` pattern as `CreateCategoryUseCase`. Failure → `console.warn`, do not roll back.
6. **Cache invalidation**: `try { await merchantCache.invalidateByCategoryId(input.id) } catch (err) { console.warn('category cache invalidation failed', { id: input.id, err }) }` — best-effort per REQ-AC-008.
7. Return the updated `Category`.

The `persistEmbedding` private helper is duplicated (not extracted) — same shape as `CreateCategoryUseCase.persistEmbedding`. YAGNI: extracting a shared module requires a third file and a new public surface for two call sites.

### `DeleteCategoryUseCase`

```ts
export interface DeleteCategoryInput {
  readonly actor: Actor;
  readonly id: string;
}

class DeleteCategoryUseCase {
  constructor(
    database: DatabasePort,
    categoryTableRef: TableRef<Category>,
    merchantCache: MerchantCachePort,
  ) {}

  async execute(input: DeleteCategoryInput): Promise<void>
}
```

**Flow**:
1. `assertIsAdmin(input.actor)` → 403 via `routeError`
2. `database.select(...)` with `where: { id }` → if empty, throw `Error('Category not found')` → 404
3. **Cache invalidation**: best-effort `try/catch` around `merchantCache.invalidateByCategoryId(input.id)` (same pattern as update). WARN log on failure.
4. `database.delete(categoryTableRef, { id: input.id })` wrapped in `try/catch`. On error, if the message contains the FK violation sentinel (Drizzle surfaces Postgres SQLSTATE `23503` as `error.message` containing `foreign key`), re-throw `new Error('Category in use by transactions')` (route catches prefix → 409). Otherwise re-throw original.
5. Return `void`.

**Why best-effort cache invalidation runs BEFORE delete**: if the FK violation throws, the cache has already been cleared. This is acceptable — the cache rows point at a now-referenced category and will be re-populated by the next transaction that successfully categorizes (if any). If the admin unassigns transactions later, the cache stays clean. Net effect: at worst we over-invalidate, never under-invalidate.

## 3. Modified `MerchantCachePort`

```ts
export interface MerchantCachePort {
  findByMerchant(merchant: string): Promise<{ categoryId: string } | null>;
  save(merchant: string, categoryId: string): Promise<void>;

  /**
   * Delete every cache row whose `category_id` matches.
   * Called by admin PATCH/DELETE on a category so future transactions
   * re-classify against the new identity (REQ-AC-008).
   */
  invalidateByCategoryId(categoryId: string): Promise<void>;
}
```

**Implementation** (`MerchantCacheAdapter`):

```ts
const INVALIDATE_SQL = 'DELETE FROM merchant_category_cache WHERE category_id = $1';

async invalidateByCategoryId(categoryId: string): Promise<void> {
  await this.requireQuery()(INVALIDATE_SQL, [categoryId]);
}
```

Reuses the existing `requireQuery()` helper (which resolves `database.query` with the `this` bind lesson from phase-5 baked in). No new infrastructure primitives.

## 4. HTTP Route Wiring

### `categories.routes.ts` — new branches

Add `updateCategoryUseCase` and `deleteCategoryUseCase` to `CategoriesRoutesDeps`. After the GET/POST branches, add:

```ts
const idMatch = /^\/categories\/[^/]+$/.test(event.rawPath);
const pathId = idMatch ? event.rawPath.split('/').pop()! : '';

if (method === 'PATCH' && idMatch) {
  const body = parseBody(event);
  const name = body.name === undefined ? undefined :
    typeof body.name !== 'string' || !body.name.trim()
      ? (() => { throw new HttpError(400, 'Field "name" must be a non-empty string'); })()
      : body.name.trim();
  const color = body.color === undefined ? undefined :
    typeof body.color !== 'string' || !body.color.trim()
      ? (() => { throw new HttpError(400, 'Field "color" must be a non-empty string'); })()
      : body.color.trim();
  if (name === undefined && color === undefined) {
    throw new HttpError(400, 'At least one of "name" or "color" is required');
  }
  if (color !== undefined && !HEX_COLOR.test(color)) {
    throw new HttpError(400, 'Field "color" must be a hex color like #AABBCC');
  }
  const updated = await deps.updateCategoryUseCase.execute({
    actor, id: pathId, patch: { name, color },
  });
  return jsonResponse(200, updated);
}

if (method === 'DELETE' && idMatch) {
  await deps.deleteCategoryUseCase.execute({ actor, id: pathId });
  return jsonResponse(204, {});
}
```

**CORS extension** (`http.utils.ts`): change `Access-Control-Allow-Methods` to `GET,POST,PATCH,DELETE,OPTIONS`. Browser preflight on PATCH/DELETE will fail without this.

### `api.routes.ts` — path dispatch

Replace the existing `if (event.rawPath === '/categories')` branch with:

```ts
if (event.rawPath === '/categories' || /^\/categories\/[^/]+$/.test(event.rawPath)) {
  return categories(event);
}
```

The handler itself discriminates by `method` and path segment count. This matches the existing pattern for `/transactions/{id}/categorize` (regex match + method dispatch).

### Error mapping (already wired by `routeError`)

- `assertIsAdmin` throws plain `Error('Forbidden: …')` → 403
- Use case throws `Error('Category not found')` → `routeError` substring-matches `'not found'` → 404
- DELETE use case throws `Error('Category in use by transactions')` → route catches `startsWith('Category in use by transactions')` → 409

Optional string helper added to `routeError` family: the DELETE branch wraps the use-case call in a `try/catch` that maps the prefix exactly like the POST branch maps `'Category slug already exists'`.

## 5. Embedding Re-computation (PATCH)

Reuses `CreateCategoryUseCase`'s `persistEmbedding` shape **unchanged**:

```ts
const UPDATE_EMBEDDING_SQL =
  'UPDATE categories SET embedding = $1::vector WHERE id = $2';

private async persistEmbedding(id: string, name: string, slug: string): Promise<void> {
  try {
    const embedding = await this.llm.embed(`${name} ${slug}`);
    if (!this.database.query) throw new Error('database.query unavailable');
    await this.database.query(UPDATE_EMBEDDING_SQL, [JSON.stringify(embedding), id]);
  } catch (err) {
    console.warn('category embedding failed', { id, slug, err });
  }
}
```

- **Conditional**: only fires when `patch.name` is provided (REQ-AC-008 scenario "color only → no embedding recompute").
- **Fire-and-forget**: `void this.persistEmbedding(...)` — the use case returns before the embed resolves.
- **Failure mode**: WARN log, row keeps the old embedding until the next deploy or manual re-compute. Same trade-off as `CreateCategoryUseCase` (proposal Risk 1).

## 6. Test Strategy

| File | Scenarios | Notes |
|------|-----------|-------|
| `update-category.use-case.test.ts` | 7 | (1) admin name-only → 200 + embed fires + cache invalidated; (2) admin color-only → 200 + embed NOT called + cache invalidated; (3) admin both → embed uses new name; (4) non-admin → 403, no DB write, no embed; (5) invalid color → 400-style error, no DB write; (6) `llm.embed` throws → 200 + WARN logged + cache still invalidated; (7) not found → 404 error. Mocks: `DatabasePort`, `LLMPort`, `MerchantCachePort`. |
| `delete-category.use-case.test.ts` | 5 | (1) admin → delete + cache invalidated; (2) non-admin → 403, no DB write, no cache call; (3) not found → 404 error; (4) FK conflict → throws `Error('Category in use by transactions')`; (5) cache invalidation failure → delete still succeeds, WARN logged. Mocks: `DatabasePort`, `MerchantCachePort`. |
| `merchant-cache.adapter.test.ts` | +1 | `invalidateByCategoryId` issues `DELETE FROM merchant_category_cache WHERE category_id = $1` with the right param. |
| `categories.routes.test.ts` | +6 | PATCH admin + name → 200; PATCH non-admin → 403; PATCH empty body → 400; PATCH invalid color → 400; DELETE admin → 204; DELETE FK conflict → 409. Reuses the same `makeEvent` helper, extended to accept `method: 'PATCH' \| 'DELETE'` and a `path` override. |

All tests follow the existing pattern: `vi.fn()` mocks, `vi.mocked(...).mockResolvedValueOnce(...)` for happy paths, `vi.spyOn(console, 'warn').mockImplementation(() => {})` for WARN assertions.

## 7. Composition Root Wiring

`backend/src/lambdas/api/composition.ts` — extend the `createApiRoutes` call:

```ts
const merchantCache = new MerchantCacheAdapter(database); // already exists

createApiRoutes({
  // ... existing deps ...
  updateCategoryUseCase: new UpdateCategoryUseCase(
    database, categoryTableRef, llm, merchantCache,
  ),
  deleteCategoryUseCase: new DeleteCategoryUseCase(
    database, categoryTableRef, merchantCache,
  ),
});
```

`ApiRoutesDeps` (in `api.routes.ts`) gains two readonly fields. `CategoriesRoutesDeps` (in `categories.routes.ts`) gains two readonly fields. `database`, `categoryTableRef`, `llm`, `merchantCache` are all already constructed in this file — no new imports.

## 8. Failure Modes

| Scenario | Behavior | Status |
|----------|----------|--------|
| PATCH on missing id | Use case throws `Error('Category not found')` after SELECT | 404 (routeError substring match) |
| PATCH with invalid color | Route pre-validates `^#[0-9A-Fa-f]{6}$` | 400 (`HttpError`) |
| PATCH with both fields absent | Route checks `name === undefined && color === undefined` | 400 (`HttpError`) |
| PATCH non-admin | `assertIsAdmin` throws | 403 (`routeError` prefix match) |
| PATCH `llm.embed` throws | `persistEmbedding` catches, WARN logged | 200 (operation succeeded) |
| PATCH cache invalidation throws | `try/catch` in use case, WARN logged | 200 (operation succeeded) |
| DELETE on missing id | Use case throws `Error('Category not found')` | 404 |
| DELETE non-admin | `assertIsAdmin` throws | 403 |
| DELETE with referenced transactions | Postgres FK violation → use case re-throws `Error('Category in use by transactions')` | 409 (route prefix match) |
| DELETE cache invalidation throws | `try/catch` in use case, WARN logged | 204 (operation succeeded) |
| DELETE non-existent id but cache has rows | Cache cleared (no-op effectively), then DELETE returns 0 rows → 404 | 404 (correct — the row was never there) |

## 9. Out of Scope

- Frontend (placeholder UI; no admin tooling built in this slice).
- Bulk operations (`PATCH /categories` plural).
- Cascading delete to transactions (FK prevents naturally; the 409 response is the surface).
- Soft delete (hard-delete only; the row vanishes).
- Category reordering / display ordering.
- Slug rename (proposal Locked Decision; slug is the cache key, renames would invalidate every cache row globally).
- Cache invalidation on `CreateCategoryUseCase` (phase-5 TODO; fresh slugs have no cache rows yet).
- LLM provider changes.
- New `DatabasePort.query` capabilities beyond the existing one.

## Threat Matrix

N/A — this change adds HTTP route branches (pattern already established in `api.routes.ts` for `/transactions/{id}/categorize`) and one new port method. No shell commands, subprocesses, VCS/PR automation, executable-file classification, or process integration is introduced. The `database.query` escape hatch is reused for the DELETE and invalidation SQL; that boundary is already covered by the existing `MerchantCacheAdapter` queries.

## Migration / Rollout

No migration required. The `categories` table schema is unchanged. The `merchant_category_cache` table schema is unchanged — only the rows are deleted at runtime. No feature flags; the new PATCH/DELETE branches are inert until the route receives matching requests (existing FE is a placeholder).

Rollback: revert the two new use case files, four modified files in `interfaces/http` + `infrastructure/database` + `domain/ports`, the two port additions, and the composition wiring. No destructive data — only demo categories are affected.

## Open Questions

None. All decisions locked in the proposal: name-only / color-only allowed, no slug update, color regex `^#[0-9A-Fa-f]{6}$`, embedding fire-and-forget (failure non-fatal), cache invalidation best-effort (failure non-fatal), FK conflict → 409, `invalidateByCategoryId` lives on the port (not raw SQL in the use case).
