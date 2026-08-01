# Tasks: frontend-flow-completion

> Three chained PRs stacked-to-`main`, auto-executed. Strict TDD active: every `[I]` implementation has a paired `[T]` test that runs FIRST (RED → GREEN → REFACTOR). Trivial atoms share `atoms.trivial.test.tsx` per the foundation TDD policy. `frontend-design` skill is re-read at the start of every PR that touches UI. Backend uses Vitest 2.x; frontend uses Vitest + RTL; e2e uses Playwright.
>
> **Backend line cap verification.** PR1 forecast (200) is within the 400-line budget. PR2 (≈800) and PR3 (≈500) exceed the budget and require `size:exception`. The orchestrator MUST surface the `size:exception` decision to the user before applying PR2 and PR3 (delivery strategy = `ask-on-risk`).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (total across 3 PRs) | ~1,500 |
| Per-slice forecast | PR1=200, PR2=800, PR3=500 |
| 400-line budget risk | **High** (PR2 and PR3 exceed; PR1 within) |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main (PR1 → PR2 → PR3, each merges to `main` in order) |

Decision needed before apply: Yes (PR2 and PR3 size:exception required)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Backend `PATCH /transactions/{id}` use case + route + tests (owner/admin authz, validation, merchant-cache audit) | PR1 | `cd backend && npx vitest run update-transaction.use-case.test.ts transactions.routes.test.ts` | `cd backend && npx cdk synth` (no infra delta) + manual `curl -X PATCH …/transactions/{id}` against deployed API returns 200/403/404/400 per spec | Revert PR1 → PATCH route removed; existing endpoints unaffected |
| 2 | Frontend `joinUrl` helper, `LogoutButton`, Transactions + Accounts + Admin Users flows, role-aware sidebar, router guards, Recharts install (no usage yet) | PR2 | `cd frontend && npm test` (Vitest + RTL + MSW) | `cd frontend && npx tsc --noEmit && npx eslint . && npx vite build` (bundle ≤ 250 KB gzipped before chart import) | Revert PR2 → `joinUrl` + new pages removed; `useCategories` and existing flows still work |
| 3 | `DashboardPage` (replaces `ComingSoonPage`) + `InsightsPage`, lazy-loaded Recharts charts, derived stats hook | PR3 | `cd frontend && npm test` | `npx vite build` (bundle ≤ 250 KB gzipped; Recharts split into separate chunk verified in build output) | Revert PR3 → `ComingSoonPage` restored at `/dashboard`; `InsightsPage` removed; PR2 flows unaffected |

---

## PR1 — Backend `PATCH /transactions/{id}` (forecast 200 lines, within budget)

- **Total estimated lines:** 200
- **Risk:** Low (additive use case + route branch; CDK unchanged because PATCH was widened in `phase-6-categories-crud-patch-delete`).
- **Rollback:** Revert PR1; `PATCH /transactions/{id}` disappears, every other backend endpoint unaffected, deployed frontend has no consumer yet (PR2 consumes the endpoint). Last successful Pages deployment keeps serving.
- **Verification:**
  - `cd backend && npm test` — green; target ≥158 backend tests (current 142 + ~16 new).
  - `cd backend && npx vitest run update-transaction.use-case.test.ts transactions.routes.test.ts` — green.
  - `cd infra && npx cdk synth` — confirms no CDK drift.
  - Manual smoke (deployed API): `curl -X PATCH …/transactions/{id} -H 'Authorization: Bearer …' -d '{"categoryId":"…"}'` returns 200 for owner/admin, 403 for non-owner non-admin, 404 for unknown id, 400 for missing/non-existent `categoryId`.

### Tasks

- [x] **PR1-T01** `[T]` Test for `UpdateTransactionCategoryUseCase` (`backend/src/application/use-cases/update-transaction.use-case.test.ts`) — RED: owner override succeeds; admin override on another user's row succeeds; non-owner non-admin → `Forbidden`; unknown `transactionId` → `Transaction not found`; unknown `categoryId` → error; spoofed `userId` in input is ignored for authz (REQ-FFC-BE-PATCH-TRANSACTION, REQ-FFC-AUTH-TX-OWNER). (~60 lines | test | Vitest 2.x)
- [x] **PR1-T02** `[I]` Implement `UpdateTransactionCategoryUseCase` in `backend/src/application/use-cases/update-transaction.use-case.ts` — GREEN: load transaction by `id` only → `assertCanActAs(actor, transaction.userId)` AFTER load → category existence check → `database.update(...)` → best-effort `merchantCachePort.save(normalized, categoryId)` (REQ-FFC-BE-PATCH-AUDIT, REQ-FFC-TC-OVERRIDE). (~50 lines | source)
- [x] **PR1-T03** `[I]` Add PATCH branch to `backend/src/interfaces/http/transactions.routes.ts` after the existing `categorizeMatch` — handle `PATCH /transactions/{id}`, parse `categoryId`, call `deps.updateTransactionCategoryUseCase.execute(...)`, map `Transaction not found` → 404, `Forbidden` → 403, validation → 400; add `UpdateTransactionCategoryUseCase` to `TransactionsRoutesDeps`. (~30 lines | source)
- [x] **PR1-T04** `[T]` Append PATCH tests to `backend/src/interfaces/http/transactions.routes.test.ts` — covers 200 (owner), 200 (admin on other user), 403 (non-owner non-admin), 404 (unknown id), 400 (missing `categoryId`), 400 (non-existent `categoryId`); MSW/fake `actor` + `useCase` stub. (~40 lines | test | Vitest 2.x)
- [x] **PR1-T05** `[R]` Refactor if needed; ensure `cd backend && npm test` green; confirm test count ≥158; rerun `cd infra && npx cdk synth` to confirm no infra drift. (~20 lines | refactor+verify | n/a)

---

## PR2 — Frontend flows (forecast 800 lines, size:exception required)

- **Total estimated lines:** 800
- **Risk:** **High** (exceeds 400-line budget; `size:exception` required). Each task stays independently mergeable; TDD RED-GREEN discipline is the safety net for the larger diff.
- **Rollback:** Revert PR2; `joinUrl` helper, `LogoutButton`, new pages, new hooks, sidebar updates, router additions, Recharts dep disappear; existing `useCategories` and Categories admin page still work. Backend PR1 (PATCH) is unused by the rolled-back frontend — no data loss, no orphaned writes.
- **Verification:**
  - `cd frontend && npm test` — green.
  - `cd frontend && npx tsc --noEmit` — green.
  - `cd frontend && npx eslint .` — green.
  - `cd frontend && npx vite build` — bundle ≤ 250 KB gzipped (Recharts installed but unused).
  - MSW handlers assert single-slash outgoing URL for every hook (REQ-FFC-TDD-INTEGRATION).
  - Pages preview URL smoke: `/transactions`, `/accounts`, `/admin/users` render with seed data.

### Tasks

- [x] **PR2-T00** Re-read `frontend-design` skill before any UI work in this slice (mandatory). Re-affirm Litografía del Sur tokens (`--ink-paper`, `--ink-cobalto`, named signal inks `positivo|negativo|fallo|alerta`), Bricolage Grotesque for display, JetBrains Mono for tabular numerics, signature elements per design §1 (ledger line numbers `N.º 0042`, bordered amount input, type-glyph strip `BANK/CASH/CARD`, email-as-line-item). (~0 lines | docs)

- [x] **PR2-T01** `[T]` Test for `joinUrl` helper (`frontend/src/services/url.test.ts`) — RED: trailing slash on base, leading slash on path, both, neither, multi-segment path, query-string preservation, non-string inputs throw `TypeError` (REQ-FFC-FE-URL-HELPER). (~80 lines | test | Vitest unit)

- [x] **PR2-T02** `[I]` Implement `joinUrl` in `frontend/src/services/url.ts` — GREEN: trim single trailing slash on base, trim single leading slash on path, join with one `/`, preserve `path === ''` returning base, throw on non-string (REQ-FFC-FE-URL-HELPER). Refactor `frontend/src/services/apiClient.ts` and every hook in `frontend/src/hooks/` (`useCategories` etc.) to use `joinUrl(apiBaseUrl, path)`; remove every `` `${baseUrl}/path}` `` template (REQ-FFC-FE-CORS-FIX). (~40 lines | source)

- [x] **PR2-T03** `[T]` Test for `LogoutButton` atom (`frontend/src/atoms/LogoutButton.test.tsx`) — colocated because it has logic (controlled callbacks + navigation); covers: renders "Sign out" (active voice), click calls `sessionStore.clear()` + navigates to `/login`, keyboard activation (Enter/Space), visible focus ring (cobalt `--ink-cobalto`), `prefers-reduced-motion` respected (REQ-FFC-FE-LOGOUT). (~40 lines | test | Vitest + RTL | atom | REQ-FFC-FE-LOGOUT | frontend-design §writing: active voice)

- [x] **PR2-T04** `[I]` Implement `LogoutButton` in `frontend/src/atoms/LogoutButton.tsx` — GREEN: native `<button type="button">`, `sessionStore.clear()` then `navigate('/login')`; `focus-visible:ring-2 ring-ink-cobalto`; `prefers-reduced-motion` honored; not role-gated. Wire into `frontend/src/templates/AppShell.tsx` masthead top-right (next to `RoleBadge` + date) per REQ-FFC-FE-LOGOUT rationale (discoverability; sidebar-bottom hides on mobile). (~30 lines | source | atom | REQ-FFC-FE-LOGOUT | frontend-design §writing + §restraint)

- [x] **PR2-T05** `[T]` Tests for `useTransactions` hook (`frontend/src/hooks/useTransactions.test.ts`) — colocated because hook has state/cache logic: TanStack Query keys, `joinUrl` URL construction (MSW asserts single-slash outgoing URL per REQ-FFC-TDD-INTEGRATION), `limit` param, `userId` param, error/loading states. (~35 lines | test | Vitest + RTL + MSW | hook | REQ-FFC-FE-URL-HELPER, REQ-FFC-TDD-INTEGRATION)

- [x] **PR2-T06** `[I]` Implement `useTransactions`, `useCreateTransaction`, `useUpdateTransaction` (PATCH for override), `useRecategorizeTransaction` (POST `/transactions/{id}/categorize`) in `frontend/src/hooks/` — GREEN: TanStack Query keys, optimistic update on PATCH (rollback on error), cache invalidation on create/recategorize; all URL construction via `joinUrl` (REQ-FFC-FE-CORS-FIX). (~60 lines | source | hook | REQ-FFC-TX-LIST, REQ-FFC-TX-CREATE-FORM, REQ-FFC-TX-OVERRIDE, REQ-FFC-TX-CATEGORIZE-BUTTON)

- [x] **PR2-T07** `[T]` Test for `TransactionTable` organism (`frontend/src/organisms/TransactionTable.test.tsx`) — colocated organism: renders rows with ledger line numbers `N.º 0042` signature (JetBrains Mono xs), currency-formatted amount (`Intl.NumberFormat('es-AR', { currency: 'ARS' })` — REQ-FFC-TX-AMOUNT-DISPLAY), PENDING chip + Recategorize button on `PENDING|FAILED`, CATEGORIZED pill click opens override dropdown, navigates row on click, optimistic update on override. (~50 lines | test | Vitest + RTL | organism | REQ-FFC-TX-LIST, REQ-FFC-TX-OVERRIDE, REQ-FFC-TX-CATEGORIZE-BUTTON, REQ-FFC-TX-AMOUNT-DISPLAY | frontend-design §signature: ledger line numbers)

- [x] **PR2-T08** `[I]` Implement `TransactionTable` organism in `frontend/src/organisms/TransactionTable.tsx` — GREEN: header strip + ledger rows (signature element), `AmountText` reuse, status chip via `Badge` (`alerta`/`fallo`), recategorize button, category pill click → `CategorySelect` dropdown; mock-only click navigate to `/transactions` (full page in PR2-T16). (~70 lines | source | organism | REQ-FFC-TX-LIST, REQ-FFC-TX-OVERRIDE, REQ-FFC-TX-CATEGORIZE-BUTTON | frontend-design §signature)

- [x] **PR2-T09** `[T]` Test for `AmountInput` atom (`frontend/src/atoms/AmountInput.test.tsx`) — colocated atom with logic (controlled input + cents-only entry): accepts only positive integer cents, rejects negative/non-integer, surfaces inline error verbatim from backend `{ message, details }` contract, currency-formatted display (`es-AR` `ARS`), tabular lining figures. (~30 lines | test | Vitest + RTL | atom | REQ-FFC-TX-CREATE-FORM, REQ-FFC-TX-AMOUNT-DISPLAY | frontend-design §signature: bordered amount input)

- [x] **PR2-T10** `[I]` Implement `AmountInput` atom in `frontend/src/atoms/AmountInput.tsx` — GREEN: bordered input per design signature, cents-only entry via `<input type="text" inputMode="numeric">` with `parseInt` validation, tabular lining figures via `font-variant-numeric: tabular-nums`. (~25 lines | source | atom | REQ-FFC-TX-CREATE-FORM | frontend-design §signature)

- [x] **PR2-T11** `[T]` Test for `CategorySelect` molecule (`frontend/src/molecules/CategorySelect.test.tsx`) — colocated molecule: populated from `useCategories`, selecting a category invokes onChange with categoryId, keyboard accessible (Tab/Enter/Space), `aria-expanded` on the trigger. (~30 lines | test | Vitest + RTL | molecule | REQ-FFC-TX-OVERRIDE | frontend-design §restraint: visible focus)

- [x] **PR2-T12** `[I]` Implement `CategorySelect` molecule in `frontend/src/molecules/CategorySelect.tsx` — GREEN: dropdown reusing `CategoryPill` for options, `aria-expanded`/`aria-controls`, calls `useUpdateTransaction` PATCH on select. (~35 lines | source | molecule | REQ-FFC-TX-OVERRIDE)

- [x] **PR2-T13** `[T]` Test for `TransactionForm` molecule (`frontend/src/molecules/TransactionForm.test.tsx`) — colocated molecule: fields `amountCents` (positive integer), `merchant` (required), `occurredAt` (date picker default today), `accountId` (select from `useAccounts`), `notes` (optional); validates against backend `{ message, details }`; surfaces inline error verbatim; submit blocked until valid. (~45 lines | test | Vitest + RTL | molecule | REQ-FFC-TX-CREATE-FORM | frontend-design §writing: active voice labels)

- [x] **PR2-T14** `[I]` Implement `TransactionForm` molecule in `frontend/src/molecules/TransactionForm.tsx` — GREEN: composes `AmountInput` + `FormField` rows, calls `useCreateTransaction` on submit, maps backend errors to inline field errors. (~50 lines | source | molecule | REQ-FFC-TX-CREATE-FORM)

- [x] **PR2-T15** `[T]` Test for `TransactionsPage` (`frontend/src/pages/TransactionsPage.test.tsx`) — colocated page: renders `TransactionTable` for current user (or admin-targeted `userId` via query param), loading/empty/error states reuse foundation patterns, `TransactionForm` mounted, preselect new account after creation, 403 → `ForbiddenPage`, 404 → list refetch removes stale row (REQ-FFC-TX-LIST, REQ-FFC-ACC-AFTER-CREATE). (~45 lines | test | Vitest + RTL | page | REQ-FFC-TX-LIST, REQ-FFC-ACC-AFTER-CREATE | frontend-design §restraint: empty state as invitation)

- [x] **PR2-T16** `[I]` Implement `TransactionsPage` in `frontend/src/pages/TransactionsPage.tsx` — GREEN: list + create form + override UX, default `limit=50`, ordered by `occurredAt` desc, preselect newest account via `useAccounts` cache, optimistic override updates list immediately. (~60 lines | source | page | REQ-FFC-TX-LIST, REQ-FFC-TX-CREATE-FORM, REQ-FFC-TX-OVERRIDE, REQ-FFC-ACC-AFTER-CREATE | frontend-design §restraint)

- [x] **PR2-T17** `[T]` Tests for `useAccounts` + `useCreateAccount` hooks (`frontend/src/hooks/useAccounts.test.ts`) — colocated: TanStack Query keys, `joinUrl` single-slash URL, `?userId=<id>` admin path, optimistic create invalidates list. (~30 lines | test | Vitest + RTL + MSW | hook | REQ-FFC-ACC-LIST, REQ-FFC-TDD-INTEGRATION)

- [x] **PR2-T18** `[I]` Implement `useAccounts` + `useCreateAccount` in `frontend/src/hooks/` — GREEN: list by userId, create returns row + invalidates list cache. (~30 lines | source | hook | REQ-FFC-ACC-LIST)

- [x] **PR2-T19** `[T]` Test for `AccountForm` molecule (`frontend/src/molecules/AccountForm.test.tsx`) — colocated: fields `name` (text required), `type` (select `BANK|CASH|CARD`); validates against backend; submit blocked until valid. (~25 lines | test | Vitest + RTL | molecule | REQ-FFC-ACC-CREATE-FORM)

- [x] **PR2-T20** `[I]` Implement `AccountForm` molecule in `frontend/src/molecules/AccountForm.tsx` — GREEN: composes `FormField` rows, calls `useCreateAccount` on submit, type glyph signature `BANK/CASH/CARD` per design. (~30 lines | source | molecule | REQ-FFC-ACC-CREATE-FORM | frontend-design §signature: type glyph strip)

- [x] **PR2-T21** `[T]` Test for `AccountsPage` (`frontend/src/pages/AccountsPage.test.tsx`) — colocated: renders list, admin can pass `?userId=<other>`, loading/empty/error states, form mounted, type glyph visible per row. (~30 lines | test | Vitest + RTL | page | REQ-FFC-ACC-LIST, REQ-FFC-ACC-CREATE-FORM | frontend-design §signature)

- [x] **PR2-T22** `[I]` Implement `AccountsPage` in `frontend/src/pages/AccountsPage.tsx` — GREEN: list + create form, admin `userId` query param support, optimistic create. (~45 lines | source | page | REQ-FFC-ACC-LIST, REQ-FFC-ACC-CREATE-FORM | frontend-design §signature)

- [x] **PR2-T23** `[T]` Test for `useUsers` hook (`frontend/src/hooks/useUsers.test.ts`) — colocated: TanStack Query keys, `joinUrl` single-slash URL, error states; non-admin never mounts (router guard). (~25 lines | test | Vitest + RTL + MSW | hook | REQ-FFC-USR-LIST-ADMIN, REQ-FFC-TDD-INTEGRATION)

- [x] **PR2-T24** `[I]` Implement `useUsers` in `frontend/src/hooks/useUsers.ts` — GREEN: list users (admin-only path), no caching for non-admin (guard prevents mount). (~20 lines | source | hook | REQ-FFC-USR-LIST-ADMIN)

- [x] **PR2-T25** `[T]` Test for `UserForm` molecule (`frontend/src/molecules/UserForm.test.tsx`) — colocated: fields `email`, `name`, `tier` (`BRONZE|SILVER|GOLD`); validates against backend; submit blocked until valid. (~25 lines | test | Vitest + RTL | molecule | REQ-FFC-USR-CREATE-ADMIN)

- [x] **PR2-T26** `[I]` Implement `UserForm` molecule in `frontend/src/molecules/UserForm.tsx` — GREEN: composes `FormField` rows, calls admin create endpoint, JetBrains Mono email display per design signature. (~30 lines | source | molecule | REQ-FFC-USR-CREATE-ADMIN | frontend-design §signature: email-as-line-item)

- [x] **PR2-T27** `[T]` Test for `UsersAdminPage` (`frontend/src/pages/UsersAdminPage.test.tsx`) — colocated: admin renders list, non-admin renders `ForbiddenPage` and never issues `GET /users`, loading/empty/error states, email rendered in JetBrains Mono. (~30 lines | test | Vitest + RTL | page | REQ-FFC-USR-LIST-ADMIN, REQ-FFC-USR-CREATE-ADMIN | frontend-design §signature)

- [x] **PR2-T28** `[I]` Implement `UsersAdminPage` in `frontend/src/pages/UsersAdminPage.tsx` — GREEN: list + create form, email-as-line-item signature, `ForbiddenPage` redirect for non-admin. (~40 lines | source | page | REQ-FFC-USR-LIST-ADMIN, REQ-FFC-USR-CREATE-ADMIN | frontend-design §signature)

- [x] **PR2-T29** `[I]` Update `frontend/src/components/Sidebar.tsx` (or equivalent) — role-aware links per REQ-FFC-FE-SIDEBAR-ROLE: `user` sees Dashboard, Transacciones, Cuentas, Insights; `admin` adds Categorías, Usuarios after user links. Active link keeps cobalt left border treatment. (~25 lines | source | organism | REQ-FFC-FE-SIDEBAR-ROLE)

- [x] **PR2-T30** `[I]` Update `frontend/src/app/router.tsx` — add `/transactions` and `/accounts` (auth required via `RequireAuth`), `/admin/users` (admin required via `RequireRole('admin')`); reuse existing guards; `derivePageName` updated for the three new page names. (~20 lines | source | infra | REQ-FFC-FE-SIDEBAR-ROLE, REQ-FFC-USR-LIST-ADMIN)

- [x] **PR2-T31** `[I]` Install Recharts dep (`cd frontend && npm i recharts --save`); pin compatible version; no import yet (PR3 consumes it). (~5 lines | config | infra)

- [x] **PR2-T32** `[R]` Refactor if needed; verify `cd frontend && npm test` green; confirm bundle size still under 250 KB gzipped (Recharts installed but unused — actual chart import deferred to PR3). (~15 lines | refactor+verify | n/a)

---

## PR3 — Dashboard + Insights (forecast 500 lines, size:exception required)

- **Total estimated lines:** 500
- **Risk:** **High** (exceeds 400-line budget; `size:exception` required). Lazy-loaded Recharts + derived stats + Insights period selector concentrate risk; TDD discipline + bundle budget guard are the safety net.
- **Rollback:** Revert PR3; `ComingSoonPage` restored at `/dashboard`, `InsightsPage` removed, sidebar reverts to 5 links without Insights, Recharts import disappears (chunk not emitted). PR2 flows unaffected.
- **Verification:**
  - `cd frontend && npm test` — green.
  - `cd frontend && npx tsc --noEmit` — green.
  - `cd frontend && npx eslint .` — green.
  - `cd frontend && npx vite build` — bundle ≤ 250 KB gzipped; Recharts split into separate chunk verified in build output (chart code only loads when `DashboardPage` mounts).
  - Manual smoke (deployed Pages): `/dashboard` renders with seed data; `/insights` renders period selector + 12-month line chart + breakdown + top merchants.

### Tasks

- [ ] **PR3-T00** Re-read `frontend-design` skill before any UI work in this slice (mandatory). Re-affirm: dashboard big number (Bricolage Grotesque 700 64px), skeletons not spinners, Recharts slice colors from category `color` hex, JetBrains Mono tabular month labels (`ENE 2026`), Insights active-voice empty-state copy. (~0 lines | docs)

- [ ] **PR3-T01** `[T]` Test for `useDashboardStats` hook (`frontend/src/hooks/useDashboardStats.test.ts`) — colocated: derives MTD spend (sum of `amountCents` WHERE `status='CATEGORIZED'` AND `occurredAt >= start of month`), top 3 categories, PENDING/FAILED counts, from `useTransactions` cache; locale-aware currency formatting `es-AR` `ARS`. (~35 lines | test | Vitest unit | hook | REQ-FFC-DASH-STATS)

- [ ] **PR3-T02** `[I]` Implement `useDashboardStats` in `frontend/src/hooks/useDashboardStats.ts` — GREEN: pure derivation over `useTransactions` data; memoized; returns zero-filled shape on empty. (~35 lines | source | hook | REQ-FFC-DASH-STATS)

- [ ] **PR3-T03** `[T]` Test for `StatsCard` organism (`frontend/src/organisms/StatsCard.test.tsx`) — colocated: renders big number (Bricolage Grotesque 700 64px on hero card), small label, currency-formatted amount, accessible name from `aria-label`. (~25 lines | test | Vitest + RTL | organism | REQ-FFC-DASH-STATS | frontend-design §signature: big number)

- [ ] **PR3-T04** `[I]` Implement `StatsCard` organism in `frontend/src/organisms/StatsCard.tsx` — GREEN: paper card, big number per design signature, named signal ink for PENDING/FAILED deltas. (~25 lines | source | organism | REQ-FFC-DASH-STATS | frontend-design §signature)

- [ ] **PR3-T05** `[T]` Test for `RecentTransactionsList` organism (`frontend/src/organisms/RecentTransactionsList.test.tsx`) — colocated: uses `useTransactions({ limit: 5 })`, renders 5 rows, each row navigates to `/transactions` on click (uses `MemoryRouter` in test). (~25 lines | test | Vitest + RTL | organism | REQ-FFC-DASH-RECENT-LIST)

- [ ] **PR3-T06** `[I]` Implement `RecentTransactionsList` organism in `frontend/src/organisms/RecentTransactionsList.tsx` — GREEN: 5 most recent rows, `useNavigate` to `/transactions` on row click, ledger line number prefix preserved. (~25 lines | source | organism | REQ-FFC-DASH-RECENT-LIST)

- [ ] **PR3-T07** `[T]` Test for `SpendDonut` chart organism (`frontend/src/organisms/SpendDonut.test.tsx`) — colocated: slice colors from category `color` hex, slices `<1%` aggregate into `Otros` slice with tooltip explanation, renders inside `ResponsiveContainer`. (~30 lines | test | Vitest + RTL | organism | REQ-FFC-DASH-DONUT)

- [ ] **PR3-T08** `[I]` Implement `SpendDonut` in `frontend/src/organisms/SpendDonut.tsx` — GREEN: Recharts `<PieChart>`/`<Pie>` with `Otros` aggregation logic, category hex fill, `<Cell>` per slice, `Tooltip` explains aggregation. Imported via `React.lazy()` in the page (PR3-T12) so chart code is its own chunk. (~35 lines | source | organism | REQ-FFC-DASH-DONUT, REQ-FFC-DASH-CHART-LAZY)

- [ ] **PR3-T09** `[T]` Test for `MonthlySparkline` chart organism (`frontend/src/organisms/MonthlySparkline.test.tsx`) — colocated: 6-month trailing window, X-axis month labels in JetBrains Mono, cobalt dot at current month, empty state when fewer than 2 data points (no chart, no zero). (~30 lines | test | Vitest + RTL | organism | REQ-FFC-DASH-SPARKLINE)

- [ ] **PR3-T10** `[I]` Implement `MonthlySparkline` in `frontend/src/organisms/MonthlySparkline.tsx` — GREEN: Recharts `<LineChart>`/`<Line>`, cobalt dot at current month, JetBrains Mono month labels, quiet empty state component. Imported via `React.lazy()` in the page. (~30 lines | source | organism | REQ-FFC-DASH-SPARKLINE, REQ-FFC-DASH-CHART-LAZY)

- [ ] **PR3-T11** `[T]` Test for `DashboardPage` (`frontend/src/pages/DashboardPage.test.tsx`) — colocated: hero `StatsCard` for MTD spend, three top-category cards, PENDING/FAILED counts, `RecentTransactionsList` (5 rows), `SpendDonut` + `MonthlySparkline` each in `<Suspense fallback={<Skeleton/>}>`, skeletons replace spinners per REQ-FFC-DASH-LOADING, no API call when empty data. (~45 lines | test | Vitest + RTL + MSW | page | REQ-FFC-DASH-STATS, REQ-FFC-DASH-RECENT-LIST, REQ-FFC-DASH-DONUT, REQ-FFC-DASH-SPARKLINE, REQ-FFC-DASH-LOADING, REQ-FFC-DASH-CHART-LAZY | frontend-design §restraint: skeletons, not spinners)

- [ ] **PR3-T12** `[I]` Implement `DashboardPage` in `frontend/src/pages/DashboardPage.tsx` — GREEN: 12-col grid (hero spans 6, three stat cards span 2 each, donut + sparkline 6/6 below, recent 12), replaces `ComingSoonPage` route binding in `frontend/src/app/router.tsx`; `React.lazy` for both charts with `<Suspense fallback={<Skeleton/>}>`. (~50 lines | source | page | REQ-FFC-DASH-STATS through REQ-FFC-DASH-CHART-LAZY | frontend-design §signature: big number hero)

- [ ] **PR3-T13** `[T]` Test for `InsightsPage` (`frontend/src/pages/InsightsPage.test.tsx`) — colocated: 12-month line chart (cobalt dot at current month, JetBrains Mono month labels), sortable breakdown table (`total | Δ% | Δ absolute | count`), top 10 merchants (merchant name + currency amount + count + dominant category pill), period selector (`Este mes | Mes pasado | Últimos 3 meses | Últimos 6 meses | Últimos 12 meses`), active-voice empty state with CTA to `/transactions`, skeletons for chart + table while loading. (~55 lines | test | Vitest + RTL + MSW | page | REQ-FFC-INSIGHTS-ROUTE, REQ-FFC-INSIGHTS-TREND, REQ-FFC-INSIGHTS-BREAKDOWN, REQ-FFC-INSIGHTS-TOP-MERCHANTS, REQ-FFC-INSIGHTS-PERIOD, REQ-FFC-INSIGHTS-STATES | frontend-design §writing: active voice empty state)

- [ ] **PR3-T14** `[I]` Implement `InsightsPage` in `frontend/src/pages/InsightsPage.tsx` — GREEN: 12-month trend chart, breakdown table (sort by any column), top merchants section, period selector triggers refetch via TanStack Query key, empty state with CTA. (~70 lines | source | page | REQ-FFC-INSIGHTS-TREND through REQ-FFC-INSIGHTS-STATES | frontend-design §writing)

- [ ] **PR3-T15** `[I]` Update `frontend/src/components/Sidebar.tsx` — add Insights link between Dashboard and Transactions for both `user` and `admin` roles (per REQ-FFC-INSIGHTS-ROUTE). (~5 lines | source | organism | REQ-FFC-INSIGHTS-ROUTE)

- [ ] **PR3-T16** `[I]` Update `frontend/src/app/router.tsx` — add `/insights` route for any authenticated role; mount `InsightsPage` inside `AppShell`. (~5 lines | source | infra | REQ-FFC-INSIGHTS-ROUTE)

- [ ] **PR3-T17** `[R]` Refactor if needed; verify `cd frontend && npm test` green; `npx vite build` green; bundle size ≤ 250 KB gzipped; verify Recharts split into separate chunk by inspecting `dist/assets/*.js` chunk names (no chart code in main bundle). (~15 lines | refactor+verify | n/a)

---

## Notes for sdd-apply

- **Chain.** All three PRs base = `main`, stacked. No feature-branch chain needed. Order: PR1 → PR2 → PR3.
- **`size:exception`.** PR2 (~800 LOC) and PR3 (~500 LOC) exceed the 400-line review budget and require `size:exception`. The orchestrator MUST ask the user via `ask-on-risk` BEFORE applying PR2 and PR3. PR1 stays within budget; no exception needed.
- **`frontend-design` skill.** MUST be re-read at PR2-T00 and PR3-T00 (per user mandate). Every UI task's description above cites `frontend-design` (`§signature`, `§restraint`, or `§writing`).
- **Strict TDD.** Every `[I]` implementation has a paired `[T]` test that runs FIRST. PR2-T03 (`LogoutButton`) is colocated because the atom has logic; trivial atoms (none in this slice — every new atom has logic) would share `atoms.trivial.test.tsx` per the foundation policy.
- **Bundle budget.** Keep initial JS ≤ 250 KB gzipped. PR2 installs Recharts but does not import it. PR3 imports via `React.lazy()` so the chart code is its own chunk; verify in `dist/assets/` after `vite build`.
- **Litografía del Sur.** Every page has its own signature element per design §1: `N.º 0042` ledger numbers (Transactions), bordered amount input with cents-only entry (TransactionForm), `BANK/CASH/CARD` type glyph strip (Accounts), email-as-line-item in JetBrains Mono (Users), big number hero in Bricolage Grotesque 700 64px (Dashboard).
- **Reject markers.** Any `[T]` or `[I]` task that introduces `cloudflare/pages-action@v1` or `Category.icon` MUST be rejected (carry-forward from foundation).
- **Threat matrix applicability.** N/A (same as foundation design: no shell, subprocess, VCS/PR automation, executable-file classification, or process integration introduced; only React Router routes added — non-sensitive).