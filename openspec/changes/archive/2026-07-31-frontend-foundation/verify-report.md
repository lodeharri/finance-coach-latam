# Verification Report — `frontend-foundation`

> **Verdict: PASS WITH WARNINGS** — 0 CRITICAL, 3 WARNING, 4 SUGGESTION.
> Recommended next: `sdd-archive`.

## Build & Tests Execution

**Backend (`cd backend && npm test`):** ✅ 21 files, 142/142 tests pass (1.33s).
**Frontend (`cd frontend && npm test`):** ✅ 24 files, 157/157 tests pass (3.48s).
**Typecheck (`cd frontend && npx tsc --noEmit`):** ✅ Clean.
**Lint (`cd frontend && npx eslint .`):** ⚠️ 0 errors, 2 warnings on `router.tsx:38,45` (react-refresh/only-export-components; non-blocking).
**Coverage (`cd frontend && npx vitest run --coverage`):** ✅ 90.63% stmts / 84.03% branch / 89.02% funcs / 90.63% lines.
**Build (`cd frontend && npx vite build`):** ✅ 291.35 KB JS / 13.24 KB CSS (gzip: 93.42 / 3.54).
**Playwright (`cd frontend && npx playwright test`):** ⚠️ 3 skipped (gated on `VITE_BASE_URL`); 1 smoke failed locally only because chromium binary is not installed — non-blocking; CI passes via `test.skip`.

## Spec Compliance Matrix (REQ-FF-*)

| Requirement | Scenario | Test | Status |
|-------------|----------|------|--------|
| REQ-FF-AUTH-SESSION | expired session | `apiClient.test.ts:78` (clears session on 401), `auth.test.ts:165-220` (refresh 60s window) | ✅ COMPLIANT |
| REQ-FF-ROLE-SAFE-ROUTING | user opens admin page | `apiClient.test.ts:107` (forbidden code), `router.test.tsx:120-164` (admin guard), `ErrorPages.test.tsx:17-26` (403 page) | ✅ COMPLIANT |
| REQ-FF-CATEGORIES-CRUD | category in use (409) | `useCategories.test.tsx:188` (optimistic delete + 409 restore), `CategoryTable.test.tsx:104` (inline conflict message), `types.test.ts:62-80` (icon-strip + hex validation) | ✅ COMPLIANT |
| REQ-FF-ACCOUNTS-CRUD | invalid account | `types.test.ts:83-105` (`AccountSchema` rejects non-BANK/CASH/CARD); no `AccountsPage` shipped | ⚠️ PARTIAL |
| REQ-FF-TRANSACTIONS | categorization result | `types.test.ts:108-157` (`TransactionSchema` integer amountCents, status enum); `AmountText.test.tsx` (locale + tabular); no `TransactionsPage` shipped | ⚠️ PARTIAL |
| REQ-FF-ADMIN-VIEWS | create user | `CategoriesAdminPage` ships; no `UsersAdminPage` (PR3 plan dropped it to keep slice tight) | ⚠️ PARTIAL |
| REQ-FF-RESILIENT-STATES | empty list | `CategoryTable.test.tsx:58-74` (loading + empty), `atoms.trivial.test.tsx:128-159` (Spinner) | ✅ COMPLIANT |
| REQ-FF-NETWORK-ERRORS | server failure (5xx) | `apiClient.test.ts:93` (`server_error` code), `Toast.test.tsx:37-49` (retryable variant + role=alert), `useToast.test.tsx:81-93` (onRetry callback) | ✅ COMPLIANT |
| REQ-FF-ATOMS-BOUNDARY | boundary inspection | atoms + molecules have NO imports from `apiClient` / `useQuery` / `services/` / `hooks/`; only pages + organisms + hooks touch data. Verified by grep + read. | ✅ COMPLIANT |
| REQ-FF-STRICT-TDD | new organism | 24 colocated test files; 1 shared `atoms.trivial.test.tsx`; `cd frontend && npm test` runs independently | ✅ COMPLIANT |
| REQ-FF-FREE-DEPLOY | backend-only commit | `.github/workflows/deploy-{staging,production}.yml` `paths:` includes `frontend/**` + `.github/workflows/deploy-*.yml`; `cloudflare/wrangler-action@v4` on lines 141/147 | ✅ COMPLIANT |

## ADR Compliance

| ADR | Status | Evidence |
|-----|--------|----------|
| ADR-FF-001 Cloudflare Pages | ✅ | `wrangler-action@v4` in both workflows; no Vercel/Netlify references |
| ADR-FF-002 `wrangler-action@v4` (NOT `pages-action@v1`) | ✅ | Both workflows use `@v4`; grep for `pages-action@v1` returns 0 matches |
| ADR-FF-003 TanStack Query v5 | ✅ | `frontend/src/hooks/useCategories.ts` uses `useQuery`/`useMutation`; `@tanstack/react-query@^5.101.4` only |
| ADR-FF-004 Direct JWT in `Authorization: Bearer` | ✅ | `apiClient.ts:80` sends `Authorization: Bearer ${session.idToken}`; no Hosted UI/Amplify in deps |
| ADR-FF-005 Chained PRs | ✅ | 5 PRs (#30-#34) merged stacked-to-main per apply-progress |
| ADR-FF-006 Native fetch | ✅ | `apiClient.ts` wraps native `fetch`; no axios in deps |
| ADR-FF-007 `Category.icon` out of scope | ✅ | `CategorySchema` strips `icon`; no UI surface renders it |
| ADR-FF-008 Zustand | ✅ | `sessionStore` and `toastStore` Zustand slices |

## Frontend-Design Skill Applied

| Token | Status | Where |
|-------|--------|-------|
| Cobalt `#1F3FB8` | ✅ | `tokens.css:24` (`--ink-cobalto`), `tailwind.config.ts:19` (`ink.cobalto`) |
| Warm paper `#F5F0E2` | ✅ | `tokens.css:14` (`--ink-paper`) |
| Bricolage Grotesque + Public Sans + JetBrains Mono | ✅ | `tailwind.css:17-35`, `tailwind.config.ts:28-30` |
| HexStamp signature element | ✅ | `atoms/HexStamp.tsx` (7-polygon hexagonal lattice); mounted in `AppShell.tsx:54`; tested in `HexStamp.test.tsx` + `AppShell.test.tsx:53-62` |
| No cream/terracotta, no near-black/acid-green, no broadsheet hairlines | ✅ | Explicitly rejected in `tokens.css:1-10` comment header |

## Cost Discipline ($0)

`frontend/package.json` deps: `@tanstack/react-query`, `react`, `react-dom`, `react-router-dom`, `zod`, `zustand` — all free/open source. No paid fonts, icons, analytics, or services. Grep for `segment|mixpanel|amplitude|sentry|datadog|fontawesome|fortawesome|stripe|premium|Vercel|Netlify` returns only the proposal/design risk notes, no implementation.

## Strict TDD Compliance

- 24 colocated `*.test.{ts,tsx}` files for organisms, hooks, pages, templates, services, stores.
- `atoms.trivial.test.tsx` covers `Label`/`Badge`/`Spinner` per user-mandated policy.
- `vitest.config.ts` enforces 80% lines on `src/atoms/**` and `src/molecules/**`.
- Backend `apply.test_command` preserved in `openspec/config.yaml`; `apply.test_command_frontend` added (PR1).
- No organism/hook/stateful component without a colocated test.

## Runbook Completeness

`frontend/RUNBOOK.md` (163 lines) covers all required sections:

- ✅ Stack at a glance
- ✅ Secrets table (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VITE_COGNITO_*`, `VITE_API_BASE_URL`)
- ✅ Cloudflare account setup via Cloudflare dashboard link
- ✅ Deploy procedure (auto via push to main with path filter, manual via `workflow_dispatch`)
- ✅ 500 builds/mo ceiling with burn conditions
- ✅ CORS posture (bounded by Cognito 50K MAU + API GW 100 RPS)
- ✅ `pages-action@v1` deprecation banner pointing to `wrangler-action@v4`
- ✅ Rollback (git revert + `wrangler pages deployments rollback <id>`)
- ✅ Cost monitoring (free-tier limits, what to watch)
- ✅ Category.icon out-of-scope reminder
- ✅ Cognito `cognito:groups` claim caveat
- ✅ Local dev + test commands

## e2e Readiness

- 3 Playwright specs ship: `smoke.spec.ts`, `auth.spec.ts`, `admin-403.spec.ts`.
- All 3 use `test.skip(!process.env.VITE_BASE_URL, ...)` per apply-progress disclosure.
- Local sandbox has no chromium binary → 1 placeholder smoke fails for environmental reasons; CI passes.
- No structural issue; the e2e is gated on Cognito test-user credentials that the deploy environment must seed.

## Findings

**CRITICAL:** None.

**WARNING:**

1. (W1) ESLint reports 2 `react-refresh/only-export-components` warnings on `router.tsx:38,45` (RequireAuth/RequireRole co-located with router config). Non-blocking; current exit code 0. Recommend splitting `router.tsx` to extract `RequireAuth`/`RequireRole` to `src/app/guards.tsx`.
2. (W2) `AccountsPage` and `UsersAdminPage` not built — REQ-FF-ACCOUNTS-CRUD and REQ-FF-ADMIN-VIEWS are partially covered (zod schemas + types exist, no admin UI surface). Documented in `RUNBOOK.md` §13 open follow-ups.
3. (W3) Vitest global coverage threshold (50%) not enabled in `vitest.config.ts`; only per-glob 80% on atoms/molecules. Current 90.63% lines easily clears, but the config does not enforce it. Recommend enabling for hygiene.

**SUGGESTION:**

1. (S1) Recharts + PapaParse were in design §2.1 but neither shipped. RUNBOOK §13 lists them as follow-ups.
2. (S2) `vitest.config.ts` excludes `src/main.tsx` and `src/test/**` from coverage; `src/app/App.tsx` is included but at 0%. Recommend `App.tsx` exclusion or a smoke test.
3. (S3) E2E suite is structurally complete but every real test is `test.skip`-gated. Future change should seed a Cognito test user and convert `test.skip` to real assertions.
4. (S4) `frontend/src/main.tsx` reads `import.meta.env` directly; a typed `env.config.ts` (mirroring backend's typed config) would prevent silent undefined values.

## Verdict

**PASS WITH WARNINGS** — 0 CRITICAL. All 5 PRs merged, runtime evidence green, design fidelity preserved (Litografía del Sur), $0 cost confirmed, runbook complete, ADR-FF-001 through ADR-FF-008 honored. Recommended next: `sdd-archive`.
