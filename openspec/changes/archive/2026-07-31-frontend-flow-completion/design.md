# Design: frontend-flow-completion

> Change: `frontend-flow-completion` — three chained PRs that close the gap between the deployed backend (`initial-poc` R1–R10) and the shipped frontend foundation (Categories admin only). Adds `PATCH /transactions/{id}`, completes Transactions/Accounts/Admin Users/Dashboard flows, fixes the URL/CORS double-slash bug, adds the logout button (REQ-FFC-FE-LOGOUT), and extends the Litografía del Sur aesthetic to every new surface. Backend PR1 (≈200 LOC) ships first; frontend PR2 (≈800 LOC, `size:exception`) and dashboard PR3 (≈500 LOC, `size:exception`) follow stacked-to-main.

## 1. Two-pass design process (Litografía del Sur extended)

### Pass 1 — Brainstorm (page-by-page plan)

| Page | Single job | Token subset | Signature element (unique to page) | Layout (one-line + ASCII) |
|---|---|---|---|---|
| `TransactionsPage` | List + create + categorize/override the current user's transactions | paper, paper-lift, paper-press, tinta, tinta-mute, cobalto (focus), alerta (PENDING), fallo (FAILED) | **Ledger line numbers** `N.º 0042` prefix on every row in JetBrains Mono xs | Header + filter strip + table; right rail collapses on mobile |
| `TransactionForm` (inside TransactionsPage) | Capture amount, merchant, account, date, notes | paper-press (input bg), tinta, tinta-mute, cobalto (focus), negativo (invalid) | **Bordered amount input** with cents-only entry + tabular lining figures | Single-column field stack with `FormField` rows |
| `AccountsPage` | List + create bank/cash/card accounts | paper, paper-lift, tinta, cobalto | **Type glyph strip** `BANK / CASH / CARD` as a small uppercase label on each row | Header + table; type glyph acts as row's "stamp" |
| `UsersAdminPage` | Admin-only list + create users with tier | paper, paper-lift, tinta, cobalto | **Email-as-line-item in JetBrains Mono** + small tier tag | Header + table; rows read like a ledger index |
| `CategoriesAdminPage` (extend existing) | Already shipped; this slice adds the **color swatch grid** view for visual palette review | paper-lift, tinta, plus each category's own hex | **Color swatch grid** — each category as a hex stamp; the grid IS the design system palette | Header + grid (responsive 2/3/4 cols) |
| `DashboardPage` (replaces `ComingSoonPage`) | Monthly spend, top three, PENDING/FAILED counts, last 5 transactions, donut + sparkline | paper, paper-lift, paper-press, tinta, tinta-mute, cobalto, alerta, fallo | **Single big number** in Bricolage Grotesque 700 64 px (the monthly spent total) | 12-col grid: hero card spans 6, three stat cards span 2 each, donut + sparkline 6/6 below, recent 12 |

```
TransactionsPage
+--------------------------------------------------+
| Masthead (cobalto, 48px)                          |
+--------+-----------------------------------------+
|Sidebar| N.º 0042  Shell                  8.500,00|  <- ledger row
|        | N.º 0041  Carrefour            12.340,00|
|        | N.º 0040  SUBE                  1.200,00|
|        | ...                                      |
|        | [ + Nueva transacción ]                 |
+--------+-----------------------------------------+

DashboardPage
+--------------------------------------------------+
| $ 8.500,00 ARS                  <- big number   |
| total gastado del mes                            |
+----------+----------+----------+-----------------+
| Top 1    | Top 2    | Top 3    | 12 PEND / 0 FAL |
+----------+----------+----------+-----------------+
| Spend donut          | 6-month sparkline        |
+---------------------+---------------------------+
| Last 5 transactions (clickable rows)             |
+--------------------------------------------------+
```

### Pass 2 — Critique against AI defaults (explicit rejections)

1. **Cream `#F4F1EA` + terracotta + serif display** — REJECTED for this brief. That palette is the SaaS-artisan default that floods AI output for "personal finance". Terracotta reads as "warm trustworthy generic" — closer to a Brooklyn coffee shop than to the household ledger that LATAM families actually keep. Cream flattens the cultural specificity the brief requires. Our `--ink-paper #F5F0E2` is **dustier, more ochre** than the cream default; the brand color is **cobalt**, not terracotta; amounts live in **tabular lining figures**, not a serif. The accent tokens are **named signal inks** (`positivo / negativo / fallo / alerta`), not a single warm accent. This is the same rejection as `frontend-foundation` design §1.2 and we extend it without softening.
2. **Near-black + acid-green/vermilion** — REJECTED. The "trader dashboard" trope is hostile in bright LATAM daylight (commuting, market stalls, kiosk phones) and on mid-range AMOLED. Our background is **warm paper**, not near-black; the brand color is **cobalt**, not acid-green. PENDING/FAILED chips use named signal inks (`alerta` ochre, `fallo` wine) — never a high-luminance accent.
3. **Broadsheet hairline rules + zero border-radius + dense newspaper columns** — REJECTED. Hairline rules disappear on sub-pixel laptop screens and read as noise on mobile; zero border-radius makes controls feel flat. Our rules are `1 px solid var(--ink-paper-press)` (visible, not hairline), border-radius is `2 px` (small but not flat), and columns are generous (`gap-3`, `px-6`, `py-8`). The signature element (`HexStamp`, the ledger line numbers, the big number, the type-glyph strip) carries the editorial flavor without inheriting broadsheet's readability problems.

### Signature element per page

| Page | Signature element | Why it serves the brief |
|---|---|---|
| Transactions list | Ledger line numbers `N.º 0042` prefix | Reinforces household-ledger mental model for LATAM personal finance; tabular mono |
| Transaction form | Bordered amount input with cents-only entry + tabular lining figures | Forces deliberate monetary entry; mirrors accountant's pad |
| Accounts list | Type glyph `BANK / CASH / CARD` as a small uppercase label | Single-glance type recognition; matches "atmospheric ledger" feel |
| Admin users | Email-as-line-item in JetBrains Mono | Emphasizes users are records in the system, not "people" |
| Categories admin (extended) | Color swatch grid — palette as a system | The category list IS the design palette; viewing it is self-documenting |
| Dashboard — hero | A single big number (`$ 8.500,00 ARS`) in Bricolage Grotesque 700 64 px | Per frontend-design skill: "big number + small label" is the template answer — but here the brief IS spend, so the template IS the brief. Justified. |
| Dashboard — donut | Category-color slices; `Otros` aggregate only when any slice < 1 % | Color encodes meaning (the category's hex), not decoration |
| Dashboard — sparkline | 6-month mini-line in JetBrains Mono, cobalt dot at the current month | Reads as a ledger plot |

### Quality floor (every page)

- Responsive down to 360 px (sidebar collapses; grid reflows; amount cell right-aligned on desktop, left-aligned on mobile to keep thumb-zone legible).
- Visible keyboard focus (`focus-visible:ring-2 ring-ink-cobalto`) on every interactive element; `prefers-reduced-motion` honored via `tokens.css` `--motion-*` overrides.
- Active-voice copy everywhere ("Sign out", not "Log out"; "Save changes", not "Submit"; "Recategorize", not "Try categorize again").
- Empty states are invitations, not moods ("No transactions yet. Create one to get started.").

## 2. Architecture

### 2.1 URL helper — fixes the CORS double-slash bug

`frontend/src/services/url.ts` (new, ~15 LOC + ~80 LOC tests):

```ts
export function joinUrl(base: string, path: string): string {
  if (typeof base !== 'string' || typeof path !== 'string') {
    throw new TypeError('joinUrl: base and path must be strings');
  }
  if (path === '') return base;
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
  return trimmedBase === '' ? `/${trimmedPath}` : `${trimmedBase}/${trimmedPath}`;
}
```

Edge-case tests (6 minimum): trailing slash only, leading slash only, both, neither, multi-segment path (`/a/b`), query strings (path contains `?limit=5` — preserved as-is). All hooks in `frontend/src/hooks/` use `joinUrl(apiBaseUrl, path)` (REQ-FFC-FE-URL-HELPER, REQ-FFC-FE-CORS-FIX).

### 2.2 Backend PATCH endpoint

`backend/src/application/use-cases/update-transaction.use-case.ts` (new, ~50 LOC + ~100 LOC tests). Constructor takes `DatabasePort`, `TableRef<Transaction>`, and **no** `MerchantCachePort` (override DOES upsert the cache; that side-effect lives in a private `writeCacheBestEffort` method that calls the same `MerchantCacheAdapter` indirectly via `merchantCachePort.save` — actually, pass it in to keep ports explicit). Signature:

```ts
export interface UpdateTransactionCategoryInput {
  readonly actor: Actor;
  readonly transactionId: string;
  readonly userId: string;        // requested target — may be spoofed; we ignore it for authz
  readonly categoryId: string;
}
```

Flow: assert actor → load transaction by `id` only → if missing → `throw new Error('Transaction not found')` (route maps to 404) → `assertCanActAs(actor, transaction.userId)` AFTER load (REQ-FFC-AUTH-TX-OWNER; spoofed body userId is rejected) → check `categoryId` exists via `database.select(categoriesTableRef, { where: { id }, limit: 1 })` (route layer does this too; use case is defense-in-depth) → `database.update(transactionTableRef, { id, userId: transaction.userId }, { categoryId, status: 'CATEGORIZED' })` → best-effort `merchantCachePort.save(normalize(merchant), categoryId)` (REQ-FFC-BE-PATCH-AUDIT) → return updated row.

`backend/src/interfaces/http/transactions.routes.ts` adds a PATCH branch after the existing `categorizeMatch`:

```ts
const overrideMatch = event.rawPath.match(/^\/transactions\/([^/]+)$/);
if (method === 'PATCH' && overrideMatch) {
  const body = parseBody(event);
  const userId = targetUserId(actor, body.userId); // captured for use case even though authz uses row.userId
  const categoryId = requiredString(body, 'categoryId');
  const transaction = await deps.updateTransactionCategoryUseCase.execute({
    actor, transactionId: decodeURIComponent(overrideMatch[1]!), userId, categoryId,
  });
  return jsonResponse(200, transaction, event);
}
```

CDK: **no change needed**. `infra/lib/finance-coach-stack.ts:193-198` already allows `GET, POST, PATCH, DELETE` on `corsPreflight.allowMethods`. PATCH/DELETE preflight was widened in `phase-6-categories-crud-patch-delete`. Documented in PR1 description.

### 2.3 Atomic Design boundaries

Every new organism goes through hooks only. Atoms-with-logic (e.g., `AmountInput` with cents-only validation, `LogoutButton`) keep colocated tests. Trivial atoms share `atoms.trivial.test.tsx`. Molecules (`TransactionForm`, `AccountForm`, `UserForm`, `CategorySelect`) and organisms (`TransactionTable`, `DashboardPage`) get colocated tests.

### 2.4 State, data fetching, routing

- **State**: continue Zustand. `sessionStore.clear()` already resets all fields — REQ-FFC-FE-LOGOUT handler calls `sessionStore.clear()` + `navigate('/login')` and is the **same** clear path 401 takes in `apiClient.ts:106`.
- **Data fetching**: TanStack Query, same pattern as `useCategories`. New hooks (each with colocated test + RED-first):
  - `useTransactions({ userId, limit })`, `useCreateTransaction({ userId })`, `useUpdateTransaction({ userId })`, `useRecategorizeTransaction({ userId })`
  - `useAccounts({ userId })`, `useCreateAccount({ userId })`
  - `useUsers()` (admin-only — guarded by `RequireRole` in the router so a non-admin never even mounts the query)
- **Routing**: `/transactions`, `/accounts` (auth required); `/admin/users` (admin). `RequireRole` guard already exists in `frontend/src/app/router.tsx` and is reused unchanged. AppShell stays lifted from PR5; the only change is `derivePageName` returning the new page names.
- **Recharts**: installed in PR2; used in PR3 only. Imported via `React.lazy()` inside `DashboardPage` so the chart code is its own chunk. `<Suspense fallback={<Skeleton />}>` wraps each chart per REQ-FFC-DASH-CHART-LAZY.
- **Currency formatting**: `new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })` per REQ-FFC-TX-AMOUNT-DISPLAY. Locale/currency configurable via props on `AmountText` (already shipped). Default to `'es-AR'` / `'ARS'` (LATAM focus per `README.md`). Hard-coded for v1; env-driven in v2 if multi-country arrives.

### 2.5 Logout button (REQ-FFC-FE-LOGOUT)

`frontend/src/atoms/LogoutButton.tsx` (new, ~30 LOC + colocated test). Atom with logic (controlled callbacks) → colocated test. Renders `<button>` with text **"Sign out"** (active-voice per frontend-design skill: "a control should say exactly what happens when it's used", and the active verb matches "Saved", "Signed out" toast consistency). On click: `sessionStore.clear(); navigate('/login')`. Keyboard accessible (native `<button type="button">`, focus-visible cobalt ring inherited from `Button` styles). Reduced-motion-respecting (no animation; static).

Placement: `frontend/src/templates/AppShell.tsx` masthead, **top-right**, next to `RoleBadge` and the date — visible on every authenticated page (REQ-FFC-FE-LOGOUT rationale: discoverability + masthead already carries user-context chrome; sidebar-bottom logout is hidden until scrolled and breaks mobile). `LogoutButton` is **always visible** for both roles; logout is not role-gated.

## 3. Build, test, deploy

- **Vite config**: no change. `React.lazy` handles chart splitting; route boundaries already split pages.
- **Vitest**: no config change. Colocated tests run under `cd frontend && npm test` per existing setup.
- **Backend tests**: existing Vitest 2.x setup. Add `backend/src/application/use-cases/update-transaction.use-case.test.ts` (~100 LOC) and append PATCH tests to `transactions.routes.test.ts` (~20 LOC).
- **Recharts install**: PR2 includes the dep (`npm i recharts --save`) but no usage yet; PR3 adds the imports. Bundle size guard: keep initial JS ≤ 250 KB gzipped; verify in PR3 build output.
- **Deploy**: no workflow change. `deploy-frontend` already path-filters `frontend/**` and runs on every push to `main`. Smoke step (`curl https://finance-coach-latam.pages.dev` → 200) catches deploy regressions.

## 4. ADRs

| ID | Decision | Options considered | Choice | Rationale |
|---|---|---|---|---|
| ADR-FFC-001 | Override use case | Extend `CategorizeTransactionUseCase` / new `UpdateTransactionCategoryUseCase` | **New use case** | Manual override is semantically different from LLM categorize (no keyword/cache/embed/generateText layers). Keeping them separate prevents accidental LLM invocation on user intent (REQ-FFC-TC-OVERRIDE). |
| ADR-FFC-002 | URL helper | Fix every `${baseUrl}/path}` call site / new `joinUrl` helper | **`joinUrl` helper** | Single source of truth; 4 callers today, more tomorrow. Helper is 6 LOC + 80 LOC tests vs. auditing every site forever. |
| ADR-FFC-003 | Chart library | Recharts / Chart.js | **Recharts** | Already approved in foundation design §1 (ADR-FF *); declarative React API; lazy-loadable. Bundle fit re-verified in PR3. |
| ADR-FFC-004 | Currency/locale | `Intl.NumberFormat` with `es-AR` + `ARS` / multi-locale framework / `react-intl` | **`Intl.NumberFormat` + `es-AR` + `ARS`** | Zero deps, native browser API, sufficient for v1 LATAM focus. Multi-country in v2 if needed. |
| ADR-FFC-005 | Logout placement | Masthead top-right (always visible) / sidebar bottom / settings subpage | **Masthead top-right** | Discoverability; masthead already carries user-context chrome (RoleBadge + date); sidebar-bottom logout hides below the fold and breaks on mobile collapse. |

## 5. PR slice plan

| # | Base → head | Scope | Forecast LOC | Verification | Size exception |
|---|---|---|---|---|---|
| PR1 | `main` | Backend `UpdateTransactionCategoryUseCase` + tests + `transactions.routes.ts` PATCH branch + tests; CDK unchanged (PATCH already allowed). | **200** | `cd backend && npx vitest run update-transaction.use-case.test.ts transactions.routes.test.ts` green; manual `curl -X PATCH …/transactions/{id} -H 'Authorization: Bearer …' -d '{"categoryId":"…"}'` against deployed API returns 200/403/404/400 as specified | No |
| PR2 | `main` | `frontend/src/services/url.ts` + tests; `LogoutButton` atom + test; `AppShell` wires logout; new pages `TransactionsPage`, `AccountsPage`, `UsersAdminPage` + tests; organisms `TransactionTable`, `TransactionForm`, `CategorySelect` + tests; atom `AmountInput` + test; hooks `useTransactions`, `useCreateTransaction`, `useUpdateTransaction`, `useRecategorizeTransaction`, `useAccounts`, `useCreateAccount`, `useUsers` + tests; refactor all existing hooks (`useCategories`) to use `joinUrl`; `router.tsx` adds `/transactions`, `/accounts`, `/admin/users` (admin-gated); `Sidebar.tsx` adds role-aware links; install `recharts` (no usage). | **800** | `cd frontend && npm test` green; bundle size check (still under 250 KB gzipped before chart import); MSW handlers assert single-slash outgoing URL for every hook; Pages preview URL smoke | **Yes — size:exception expected** |
| PR3 | `main` | `DashboardPage` (replaces `ComingSoonPage` route binding) + test; organisms `StatsCard`, `RecentTransactionsList` + tests; charts `SpendDonut`, `MonthlySparkline` (lazy-loaded) + tests; hook `useDashboardStats` (derives stats from `useTransactions`) + test. | **500** | `cd frontend && npm test` green; bundle size ≤ 250 KB gzipped (Recharts split into separate chunk verified in build output); Playwright dashboard smoke optional | **Yes — size:exception expected** |

Chained, stacked-to-`main`, auto-execute. PR1 must merge before PR2 (PR2 PATCH hook depends on backend); PR2 before PR3 (dashboard reads from PR2 hooks). `sdd-tasks` MUST emit the forecast lines `Decision needed before apply: Yes`, `Chained PRs recommended: Yes`, `400-line budget risk: High`.

## 6. Risks

| # | Risk | Mitigation in design | Status |
|---|---|---|---|
| 1 | PR2/PR3 exceed 400-line budget | `size:exception` documented (same policy as frontend-foundation); each PR remains focused and mergeable | Owned |
| 2 | Litografía aesthetic stops at chrome | Each page has its own signature element per §1 table; every page uses tokens (no hard-coded hex); review checklist in PR description | Owned |
| 3 | Strict TDD colocation doubles atom lines | Trivial atoms share `atoms.trivial.test.tsx` (relaxed policy from foundation); atoms-with-logic + organisms + hooks retain colocated tests per REQ-FFC-TDD-ATOMS / REQ-FFC-TDD-ORGANISMS | Owned |
| 4 | Recharts bundle size | `React.lazy` + `<Suspense>` boundary at route level; chunk splits verified in PR3 build output; fallback to skeleton | Owned |
| 5 | Override writes stale merchant-cache entry (tradeoff) | Documented: PATCH DOES upsert cache as a "learning signal" (REQ-FFC-BE-PATCH-AUDIT). User can re-override if it misroutes a future transaction. ADR not needed — already a spec decision. | Accepted (per spec) |
| 6 | Spoofed `userId` in PATCH body | Use case loads transaction by `id` only and runs `assertCanActAs(actor, transaction.userId)` AFTER load (REQ-FFC-AUTH-TX-OWNER). Test asserts body `userId` is ignored. | Owned |
| 7 | Dashboard data overflow (6-month window × all users) | Use `useTransactions({ userId, limit: 50 })` and derive stats client-side; backend `limit` cap already at 100. If data grows, swap to a dedicated `/stats` endpoint in a future change. | Accepted (in scope; out of scope to add a stats endpoint) |
| 8 | Logout click race with 401 interceptor | `sessionStore.clear()` is idempotent; both code paths converge on the same `clear()` → `navigate('/login')`. Test covers double-clear no-op. | Owned |
| 9 | Threat matrix applicability | No shell, subprocess, VCS/PR automation, executable-file classification, or process integration introduced. Only React Router routes added (non-sensitive). **Threat matrix: N/A** (same as foundation design). | Recorded |

## Open questions

None blocking. Ready for `sdd-tasks`.
