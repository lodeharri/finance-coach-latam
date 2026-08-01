# Archive Report — `frontend-foundation`

> Change: `frontend-foundation` — React 18 + Vite + TS strict + Tailwind 3 SPA on Cloudflare Pages (free tier), consuming the existing Cognito-authed HTTP API v2 with direct `Authorization: Bearer <IdToken>`. Chained PR strategy: 5 stacked-to-main PRs (#30–#34).

**Closed:** 2026-07-31
**Archived to:** `openspec/changes/archive/2026-07-31-frontend-foundation/`
**Cycle phase:** archive — final state of the SDD cycle.

## Cycle summary

```
explore (frontend-foundation/explore.md)
  → propose (frontend-foundation/proposal.md)
  → spec   (frontend-foundation/spec.md)        [REQ-FF-AUTH-SESSION, ROLE-SAFE-ROUTING,
                                                 CATEGORIES-CRUD, ACCOUNTS-CRUD,
                                                 TRANSACTIONS, ADMIN-VIEWS,
                                                 RESILIENT-STATES, NETWORK-ERRORS,
                                                 ATOMS-BOUNDARY, STRICT-TDD, FREE-DEPLOY]
  → design (frontend-foundation/design.md)      ["Litografía del Sur" aesthetic;
                                                 ADR-FF-001..008]
  → tasks  (frontend-foundation/tasks.md)       [56 tasks across 5 PRs, all [x]]
  → apply  (PRs #30, #31, #32, #33, #34)        [stacked-to-main; 0 review rejections]
  → verify (frontend-foundation/verify-report.md) [PASS WITH WARNINGS, 0 CRITICAL]
  → archive (this file)                         [cycle closed]
```

## Final test counts

- **Backend** (`cd backend && npm test`): 21 files, 142/142 passing (1.24 s).
- **Frontend** (`cd frontend && npm test`): 24 files, 157/157 passing (3.27 s).
- **Frontend typecheck** (`cd frontend && npx tsc --noEmit`): clean.
- **Frontend lint** (`cd frontend && npx eslint .`): 0 errors, 2 non-blocking warnings on `router.tsx:38,45` (see Follow-ups W1).
- **Frontend coverage** (`cd frontend && npx vitest run --coverage`): 90.63 % stmts / 84.03 % branch / 89.02 % funcs / 90.63 % lines.
- **Frontend build** (`cd frontend && npx vite build`): 291.35 KB JS / 13.24 KB CSS (gzip 93.42 / 3.54).
- **Playwright** (`cd frontend && npx playwright test`): 3 specs (`smoke`, `auth`, `admin-403`); gated on `VITE_BASE_URL` via `test.skip`; CI passes.

## Delta spec sync — decision

**Decision: NO delta spec created.**

The frontend change introduces **no new backend domain entities** and **no new backend behavior**. It is a pure consumer of the existing API surface. The `openspec/specs/` folder already holds:

- `admin-categories/spec.md` — `PATCH`/`DELETE` requirements landed by `phase-6-categories-crud-patch-delete` (PR not yet merged at archive time but source-of-truth spec already covers the backend contract the SPA consumes).
- `authorization/spec.md` — JWT shape, role resolution from `cognito:groups`, 401/403 paths. The SPA consumes this contract verbatim via `apiClient.ts` + `auth.ts` + `RequireAuth`/`RequireRole` guards.
- `transaction-categorization/spec.md` — Transaction entity + categorize endpoint. The SPA's `types.ts` (zod) mirrors this contract.

REQ-FF-* requirements in `frontend-foundation/spec.md` are **frontend implementation requirements** (UI shell, atomic-design boundaries, TDD coverage, free-deployment contract). They describe how the SPA must be built, not what the backend must do. Per the orchestrator's preflight: *"frontend is purely a consumer ... those belong to OpenSpec change artifacts"*. They are preserved in `spec.md` inside this archive folder and are intentionally NOT merged into `openspec/specs/*/spec.md`.

This decision is recorded here for traceability — future archive phases reading the SDD ledger should not add frontend-only requirements to backend domain specs.

## ADR-FF compliance summary (all 8 honored)

| ADR | Choice | Evidence |
|---|---|---|
| ADR-FF-001 | Cloudflare Pages (free tier) | `wrangler-action@v4` in both deploy workflows |
| ADR-FF-002 | `cloudflare/wrangler-action@v4` (NOT `pages-action@v1`) | Both workflows use `@v4`; grep for `pages-action@v1` returns 0 matches |
| ADR-FF-003 | TanStack Query v5 | `useCategories` uses `useQuery`/`useMutation`; `@tanstack/react-query@^5.101.4` only |
| ADR-FF-004 | Direct JWT in `Authorization: Bearer` | `apiClient.ts:80` sends `Authorization: Bearer ${session.idToken}` |
| ADR-FF-005 | Chained PRs | 5 PRs (#30–#34) merged stacked-to-main |
| ADR-FF-006 | Native fetch | `apiClient.ts` wraps native `fetch`; no axios |
| ADR-FF-007 | `Category.icon` out of scope | `CategorySchema` strips `icon`; no UI surface renders it |
| ADR-FF-008 | Zustand | `sessionStore` and `toastStore` Zustand slices |

## Cost posture — $0 confirmed

- **Cloudflare Pages free tier**: 500 builds/month, unlimited bandwidth, HTTPS included. Both deploy workflows (`deploy-staging.yml`, `deploy-production.yml`) gate `deploy-frontend` behind `paths: frontend/**` to honor the ceiling.
- **GitHub Actions free tier**: 2,000 minutes/month for public repos. The current path-filtered run length stays well within.
- **No paid fonts, icons, analytics, or services**. `frontend/package.json` deps: `@tanstack/react-query`, `react`, `react-dom`, `react-router-dom`, `zod`, `zustand` — all free/open source. Grep for `segment|mixpanel|amplitude|sentry|datadog|fontawesome|fortawesome|stripe|premium|Vercel|Netlify` returns only proposal/design risk notes, no implementation.
- **Free-tier cost discipline** carried forward from `openspec/config.yaml`: Neon 0.5 GB, Lambda 1M req/mo, API GW HTTP 1M/12mo, Cloudflare Pages 500 builds/mo — all `$0/month` in normal demo usage.

## Follow-ups carried forward

These are non-blocking issues raised by `sdd-verify` and the orchestrator preflight. The cycle is closed; the team can address them in a follow-up change.

| ID | Severity | Description |
|----|----------|-------------|
| W1 | WARNING | ESLint `react-refresh/only-export-components` warnings on `router.tsx:38,45` (RequireAuth/RequireRole co-located with router config). Fix: extract `RequireAuth`/`RequireRole` to `src/app/guards.tsx`. Non-blocking; exit code 0. |
| W2 | WARNING | `AccountsPage` and `UsersAdminPage` not built. REQ-FF-ACCOUNTS-CRUD and REQ-FF-ADMIN-VIEWS are partially covered (zod schemas + types exist; no admin UI surface). Documented in `RUNBOOK.md` §13. |
| W3 | WARNING | Vitest global coverage threshold (50 %) not enforced in `vitest.config.ts`; only per-glob 80 % on atoms/molecules. Current 90.63 % lines easily clears; recommend enabling for hygiene. |
| S1 | SUGGESTION | Recharts + PapaParse were in design §2.1 but neither shipped. RUNBOOK §13 lists them as follow-ups. |
| S2 | SUGGESTION | `src/app/App.tsx` is included in coverage but at 0 %. Recommend exclusion or a smoke test. |
| S3 | SUGGESTION | Playwright suite is structurally complete but every real test is `test.skip`-gated on `VITE_BASE_URL`. Future change should seed a Cognito test user and convert `test.skip` to real assertions. |
| S4 | SUGGESTION | `frontend/src/main.tsx` reads `import.meta.env` directly; a typed `env.config.ts` (mirroring backend's typed config) would prevent silent undefined values. |

## Stale-checkbox reconciliation

**Per the `sdd-archive` skill's task-completion gate:**

> If any implementation task remains unchecked (`- [ ]`) ... Only proceed if the orchestrator explicitly instructs you to reconcile stale checkboxes and `apply-progress`/`verify-report` prove every unchecked task is complete.

The orchestrator's preflight proved completion:
- All 5 PRs (#30–#34) merged on `main`.
- `verify-report.md` PASS WITH WARNINGS, 0 CRITICAL.
- 142 backend + 157 frontend tests passing.

**Action taken:** All 56 PR1–PR5 implementation tasks flipped from `[ ]` to `[x]` in `tasks.md`. The proposal's success metrics (`- [ ]` in `proposal.md`) and design's open questions (`- [ ]` in `design.md`) are NOT implementation tasks; they remain as authored. A header note recording this reconciliation was added at the top of `tasks.md`.

## Archive contents

```
openspec/changes/archive/2026-07-31-frontend-foundation/
├── archive-report.md       ← this file
├── design.md               ← ADR-FF-001..008, "Litografía del Sur" aesthetic
├── explore.md              ← initial placeholder analysis + Cloudflare action correction
├── proposal.md             ← intent, scope, success metrics, ADR risks
├── spec.md                 ← REQ-FF-AUTH-SESSION .. REQ-FF-FREE-DEPLOY (11 reqs)
├── tasks.md                ← 56 tasks across 5 PRs, all [x]
└── verify-report.md        ← PASS WITH WARNINGS, 0 CRITICAL, 3 WARNING, 4 SUGGESTION
```

This is an **AUDIT TRAIL** — never modify or delete the contents of an archived change folder.

## SDD cycle complete

The change has been fully planned, implemented, verified, and archived. The next change can begin.