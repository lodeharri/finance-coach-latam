# Archive Report — `frontend-flow-completion`

> Change: `frontend-flow-completion` — three chained PRs (#39 backend PATCH, #40 frontend flows, #41 dashboard + insights) plus one fix PR (#42 molecule test backfill) that close the gap between the deployed AWS backend (`initial-poc` R1–R10) and the shipped frontend foundation (Categories admin only). Adds `PATCH /transactions/{id}` with owner-or-admin authorization, completes Transactions / Accounts / Admin Users / Dashboard / Insights flows, fixes the URL/CORS double-slash bug, extends the Litografía del Sur aesthetic to every new surface, and ships a `LogoutButton` in the masthead.

**Closed:** 2026-07-31
**Archived to:** `openspec/changes/archive/2026-07-31-frontend-flow-completion/`
**Cycle phase:** archive — final state of the SDD cycle.

## Cycle summary

```
explore (frontend-flow-completion/explore.md) — omitted, change directly entered propose
  → propose (frontend-flow-completion/proposal.md) [intent, scope, 3 PRs, $0 cost]
  → spec   (frontend-flow-completion/spec.md)    [24 REQ-FFC-* + MODIFIED REQ-FFC-AUTH-TX-OWNER,
                                                  REQ-FFC-TC-OVERRIDE]
  → design (frontend-flow-completion/design.md)  [two-pass Litografía critique, ADR-FFC-001..005]
  → tasks  (frontend-flow-completion/tasks.md)   [50 tasks across 3 PRs, all [x]; PR2/PR3 size:exception]
  → apply  (PRs #39, #40, #41, #42)              [stacked-to-main; PR1 200 LOC; PR2 800 LOC;
                                                  PR3 500 LOC; PR42 ~430 LOC molecule backfill]
  → verify (verify-report.md)                    [PASS WITH WARNINGS — 1 CRITICAL fixed via #42]
  → archive (this file)                          [cycle closed]
```

## Final test counts

- **Backend** (`cd backend && npm test`): 25 files, 177/177 passing (1.56 s).
- **Frontend** (`cd frontend && npm test`): 41 files, 273/273 passing (6.22 s).
- **Frontend coverage** (`cd frontend && npx vitest run --coverage`):
  - All-glob lines: 73.37 %; per-glob `src/molecules/**`: **99.28 % lines / 95.04 % funcs / 100 % stmts / 99.28 % branches** — clears the 80 % per-glob threshold.
- **Frontend typecheck** (`cd frontend && npx tsc --noEmit`): clean.
- **Frontend lint** (`cd frontend && npx eslint .`): 0 errors, 2 non-blocking warnings on `router.tsx` (RequireAuth/RequireRole extraction).
- **Frontend build** (`cd frontend && npx vite build`): main bundle 327.45 KB (gzip **101.43 KB**); Recharts split into `CategoricalChart` (94.23 KB gz) + `MonthlySparkline` (14.34 KB gz) + `SpendDonut` (6.42 KB gz).

## Delta spec sync — decisions

Two domains required MERGE because the change introduced new contract-level behavior that did NOT exist in their existing specs:

| Domain | Action | Details |
|---|---|---|
| `authorization` | **Modified** (new requirement appended) | Added `### Requirement: PATCH /transactions/{id} authorizes against the loaded row` with 5 scenarios (owner / admin / non-owner / unknown id / spoofed body). The original `assertCanActAs`/`assertIsAdmin` requirements are unchanged — they remain the canonical helpers. The new requirement codifies the order: load row first, then `assertCanActAs(actor, transaction.userId)`, never trust the body's `userId`. |
| `transaction-categorization` | **Modified** (new requirement appended) | Added `### Requirement: Manual override path skips the categorization pipeline` with 3 scenarios (override skips LLM, override upserts cache, subsequent categorize uses the new cache row). The keyword / cache / embedding / `generateText` pipeline requirements are unchanged. The new requirement makes explicit that `PATCH /transactions/{id}` is a separate path that bypasses the entire pipeline. |
| `admin-categories` | **Not modified** | The proposal listed `admin-categories` as a modified capability, but every contract surfaced by the new dashboard and Transactions override flow (CRUD, hex color, slug uniqueness, cache invalidation on update/delete) was already covered in `openspec/specs/admin-categories/spec.md`. The change is delivery-only: Recharts consumes the existing `color` field. No `REQ-FFC-*` requirement was added under this domain. |

Frontend-only requirements (REQ-FFC-FE-* — `joinUrl` helper, `LogoutButton`, sidebar role-aware, page-level scenarios, TDD policy) are **not merged** into `openspec/specs/`. Per the precedent set in the `frontend-foundation` archive (see `openspec/changes/archive/2026-07-31-frontend-foundation/archive-report.md` §"Delta spec sync — decision"), frontend implementation requirements describe how the SPA must be built and belong to the OpenSpec change artifact, not to backend domain specs. They are preserved in `spec.md` inside this archive folder for traceability.

## ADR-FFC compliance summary (all 5 honored)

| ADR | Choice | Evidence |
|---|---|---|
| ADR-FFC-001 | New `UpdateTransactionCategoryUseCase` (not extending `CategorizeTransactionUseCase`) | `backend/src/application/use-cases/update-transaction.use-case.ts` is a separate file; `CategorizeTransactionUseCase` is not imported from the override path. REQ-FFC-TC-OVERRIDE: LLM layers not invoked. |
| ADR-FFC-002 | `joinUrl` helper | `frontend/src/services/url.ts` (15 LOC) + `url.test.ts` (5+ scenarios). No `${baseUrl}/path}` template literal remains in production code. |
| ADR-FFC-003 | Recharts | `node_modules/recharts/package.json` license: MIT. Lazy-loaded via `React.lazy()` in `DashboardPage` and `InsightsPage`. |
| ADR-FFC-004 | `Intl.NumberFormat('es-AR', 'ARS')` | `frontend/src/molecules/AmountText.tsx`. Spec REQ-FFC-TX-AMOUNT-DISPLAY requires the literal `8.500,00 ARS`; test uses locale-tolerant regex (see Follow-ups F5). |
| ADR-FFC-005 | Logout in masthead top-right | `frontend/src/templates/AppShell.tsx:45` renders `LogoutButton` next to `RoleBadge` and the date, on every authenticated page. Both `user` and `admin` see it (not role-gated). |

## Cost posture — $0 confirmed

- **Recharts** (MIT): free, included as a normal dependency.
- **Cloudflare Pages free tier**: 500 builds/month, unlimited bandwidth, HTTPS included. Both deploy workflows (`deploy-staging.yml`, `deploy-production.yml`) gate `deploy-frontend` behind `paths: frontend/**` to honor the ceiling.
- **GitHub Actions free tier**: 2,000 minutes/month for public repos. Path-filtered runs stay well within budget.
- **No paid fonts, icons, analytics, or services** introduced. Bricolage Grotesque, Public Sans, JetBrains Mono are all Google Fonts (free). Grep for `segment|mixpanel|amplitude|sentry|datadog|fontawesome|fortawesome|stripe|premium|Vercel|Netlify` returns no implementation matches.
- **Free-tier cost discipline** carried forward from `openspec/config.yaml`: Neon 0.5 GB, Lambda 1M req/mo, API GW HTTP 1M/12mo, Cloudflare Pages 500 builds/mo — all `$0/month` in normal demo usage.

## PR slice summary

| # | SHA | Scope | Forecast LOC | Actual | Notes |
|---|---|---|---|---|---|
| #39 | 2fca799 | Backend `UpdateTransactionCategoryUseCase` + route branch + tests | 200 | ~250 | CDK unchanged (PATCH widened in `phase-6-categories-crud-patch-delete`). |
| #40 | 863aac1 | Frontend `joinUrl`, `LogoutButton`, Transactions + Accounts + Admin Users flows, role-aware sidebar, router guards, Recharts install | 800 | ~830 | size:exception approved. New pages: TransactionsPage, AccountsPage, UsersAdminPage. |
| #41 | 04b48a4 | DashboardPage (replaces ComingSoonPage) + InsightsPage + lazy Recharts | 500 | ~530 | size:exception approved. Recharts split into 3 chunks. |
| #42 | f451353 | Molecule test backfill (AccountForm, UserForm, TransactionForm) | ~430 | ~430 | Fix for the 1 CRITICAL coverage threshold breach discovered in verify. |

## Follow-ups carried forward

These are non-blocking issues raised by `sdd-verify` and discovered during the cycle. The cycle is closed; the team can address them in a follow-up change.

| ID | Severity | Description |
|----|----------|-------------|
| F1 | WARNING | **Cloudflare Pages preview CORS gap.** `feat-*.finance-coach-latam.pages.dev` preview URLs are NOT in the Lambda-side `ALLOWED_ORIGINS` allowlist. Preview-deploy testing will hit CORS rejection until the origin validator is widened to support `*.finance-coach-latam.pages.dev` patterns. Local dev (`http://localhost:5173`) and production URL are unaffected. See `frontend/RUNBOOK.md` §15.4 F1 + §14.3 for the allow-list flow. |
| F2 | WARNING | **FormField `required` forwarding bug.** `frontend/src/molecules/FormField.tsx` consumes the `required` prop but does NOT forward it to the underlying `<Input>` atom — only the `*` indicator is rendered. HTML5 constraint validation never triggers on FormField-wrapped inputs. Custom form validation compensates today. Recommended fix: forward `required` plus `aria-required`, `aria-invalid`, `min`, `max`, `pattern` to the underlying input. Memory id 719. |
| F3 | WARNING | **InsightsPage Δ% / Δ abs stubbed to 0.** `frontend/src/pages/InsightsPage.tsx:113-139` sets `deltaPct` and `deltaAbs` to `0` because no month-over-month comparison window is computed. The sortable breakdown table renders these stubs. Backfilling the comparison requires a date-range query currently out of scope. |
| F4 | WARNING | **Page-level integration tests missing for 5 pages.** `TransactionsPage`, `AccountsPage`, `UsersAdminPage`, `DashboardPage`, `InsightsPage` lack dedicated page-level integration tests. Underlying hooks and organisms are covered. Unit-level coverage exceeds the 80 % per-glob threshold. |
| F5 | WARNING | **AmountText locale test is locale-tolerant.** `frontend/src/molecules/AmountText.test.tsx:17` uses `/12[.,]34/` regex because the runtime locale may default to `en-US` in jsdom. Spec REQ-FFC-TX-AMOUNT-DISPLAY requires `8.500,00 ARS` for `es-AR`; recommended fix is to pin the test fixture locale. |
| F6 | SUGGESTION | **Recharts split into 3 chunks.** Total 114.99 KB gzipped (`CategoricalChart` 94.23 + `MonthlySparkline` 14.34 + `SpendDonut` 6.42). Could consolidate to a single chart bundle. |
| F7 | SUGGESTION | **Two `react-refresh/only-export-components` warnings** in `frontend/src/app/router.tsx` from the `RequireAuth` / `RequireRole` extraction. Non-blocking (exit 0). |

## Stale-checkbox reconciliation

Per the `sdd-archive` skill's task-completion gate, every task in `tasks.md` is `[x]` and every implemented file has matching colocated tests. The cycle closed in two passes:

1. **PR #39 + #40 + #41 merged** — three chained PRs landed with 49 of 50 tasks checked. The verify step surfaced 1 CRITICAL (molecules coverage threshold breach) plus 4 WARNINGs.
2. **PR #42 merged** — molecule test backfill (`AccountForm.test.tsx`, `UserForm.test.tsx`, `TransactionForm.test.tsx`) raised molecules coverage from 43.7 % lines to 99.28 % lines, clearing the 80 % per-glob threshold and unblocking CI on subsequent PRs.

The orchestrator preflight proved completion: all 4 PRs (#39–#42) merged on `main`, verify-report PASS WITH WARNINGS (1 CRITICAL fixed via #42), 177 backend + 273 frontend tests passing.

## Archive contents

```
openspec/changes/archive/2026-07-31-frontend-flow-completion/
├── archive-report.md       ← this file
├── design.md               ← two-pass Litografía del Sur critique, ADR-FFC-001..005
├── proposal.md             ← intent, scope, success criteria, rollback plan
├── spec.md                 ← 24 REQ-FFC-* frontend + 2 MODIFIED backend deltas
├── tasks.md                ← 50 tasks across 3 PRs, all [x]; PR2/PR3 size:exception
└── verify-report.md        ← PASS WITH WARNINGS, 1 CRITICAL (fixed via #42), 4 WARNING, 2 SUGGESTION
```

This is an **AUDIT TRAIL** — never modify or delete the contents of an archived change folder.

## SDD cycle complete

The change has been fully planned, implemented, verified, and archived. The next change can begin.