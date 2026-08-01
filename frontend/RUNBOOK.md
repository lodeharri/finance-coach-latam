# RUNBOOK — Finance Coach LATAM Frontend

> Operational guide for the Cloudflare Pages SPA. Final version landed in PR5.

## 1. Stack at a glance

| Layer | Tech | Notes |
|---|---|---|
| Build | Vite 5 + TS strict | `npm run build`, output `frontend/dist/`. |
| Runtime | React 18 + React Router v6 | `src/app/App.tsx` bootstraps `QueryClientProvider` + `RouterProvider`. |
| Server state | TanStack Query v5 | One `QueryClient` per `App`. |
| Client state | Zustand | `sessionStore`, `toastStore` (PR5). |
| API client | `src/services/apiClient.ts` | Native `fetch` wrapped with Bearer interceptor + 401-onResponse handler. |
| Auth | Cognito `USER_PASSWORD_AUTH` (PR3) | Direct JWT, no Hosted UI; see ADR-FF-004. |
| Charts | Recharts (planned, PR5+) | Free, declarative. |
| CSV import | PapaParse (planned, PR5+) | Free, streaming. |

## 2. Secrets (GitHub → Settings → Secrets and variables → Actions)

| Secret | Purpose | Permission scope | Notes |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Pages deploy | `Account → Cloudflare Pages → Edit` (+ `Account → Account Settings → Read`) | **Never committed.** Provision at <https://dash.cloudflare.com/profile/api-tokens>. |
| `CLOUDFLARE_ACCOUNT_ID` | Account target | Account ID (right-side API panel of the Cloudflare dashboard) | Lower sensitivity but still secret-managed. |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | SPA build (Cognito client id) | Public at runtime, secret at build time | Sourced from CDK output `UserPoolClientId` at staging deploy; required GitHub secret for production. |
| `VITE_COGNITO_REGION` | SPA build (Cognito region) | n/a | Reused from `AWS_REGION`. |
| `VITE_API_BASE_URL` | SPA build (API URL) | n/a | Sourced from CDK output `FinanceCoachApiUrl` (staging) or GitHub Actions variable (production). |

The existing `AWS_*` secrets (backend deploy job) are unchanged.

## 3. Cloudflare Pages deployment

### 3.1 Workflows

Two workflows carry the deploy job:

- `.github/workflows/deploy-staging.yml` — push to `main` triggers the full pipeline (backend deploy first, then `deploy-frontend`).
- `.github/workflows/deploy-production.yml` — manual `workflow_dispatch`, gated by a `guard` job.

Both jobs use `cloudflare/wrangler-action@v4`. **Do not** use `cloudflare/pages-action@v1` — it was archived 2024-10-21. See ADR-FF-002.

The deploy command runs:

```
wrangler pages deploy dist --project-name=finance-coach-latam --branch=main
```

`dist/` is produced by `npm run build` in the `frontend/` working directory.

### 3.2 Path filter (mandatory)

Both workflows MUST keep `paths: [frontend/**]` plus `.github/workflows/deploy-*.yml`. Removing the filter burns the 500-builds/mo free-tier ceiling on backend-only commits. See §4.

### 3.3 Preview URLs

| Branch | URL |
|---|---|
| `main` | `https://finance-coach-latam.pages.dev` |
| Pull request | `https://<PR-number>.<project>.pages.dev` (auto-issued by Cloudflare per-PR) |

The Playwright e2e suite (PR5) targets `process.env.VITE_BASE_URL` so it can run against a PR preview or production.

## 4. 500 builds / month ceiling

Cloudflare Pages free tier allows **500 builds per month**. With the path filter in place, the team will not hit this ceiling.

**Burn conditions:**
- Removing the `paths:` filter.
- Adding unrelated paths (e.g. `backend/**`) to the filter.
- Pushing to `main` more than ~16 times per day on average.

If the ceiling is hit, every build after the limit returns a quota error and the deploy job fails. Recovery: wait for the next monthly reset, or upgrade to the paid tier ($0 is non-negotiable for this portfolio demo).

## 5. CORS posture

The backend API Gateway HTTP API v2 echoes a specific `Access-Control-Allow-Origin` header per request (never `*`). Each allowed origin is configured through the `ALLOWED_ORIGINS` environment variable on the Lambda and the `allowedOrigins` CDK context on the API Gateway stage. See §14 for the configuration flow, the allow-list resolution, and the verification recipe.

## 6. `cloudflare/pages-action@v1` is DEPRECATED

| Action | Status | Notes |
|---|---|---|
| `cloudflare/pages-action@v1` | **DEPRECATED** | Archived 2024-10-21. Do not introduce. |
| `cloudflare/wrangler-action@v4` | Current | Used in this repo. Maintainer-recommended replacement. |

See <https://github.com/cloudflare/wrangler-action> for the maintained action. ADR-FF-002 locks this choice.

## 7. Category.icon is OUT OF SCOPE

`Category.icon` is referenced in the spec text but the backend `domain/entities/category.entity.ts` does not persist it. ADR-FF-007 commits to **not rendering or POSTing an `icon` field** anywhere in the SPA. Round-tripping it would silently drop on POST. See `openspec/changes/initial-poc/design.md` for the original ADR.

## 8. Cognito `cognito:groups` claim

HTTP API v2's JWT authorizer sometimes drops the colon-prefixed `cognito:groups` claim during JSON serialization. The SPA does NOT depend on `event.requestContext.authorizer.jwt.claims` directly — it sends raw `Authorization: Bearer <IdToken>` only. The backend's `authenticate()` (`backend/src/interfaces/http/http.utils.ts:138-185`) decodes the raw Bearer as a fallback. See `design.md` §2.2 + risk #11.

## 9. Smoke verification

After every deploy, the workflow curl-checks `https://finance-coach-latam.pages.dev` for HTTP 200. The Playwright e2e suite (PR5) runs against the Pages preview URL.

```bash
# Local smoke (after `npm run dev`)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173
# Expected: 200
```

## 10. Rollback

| Path | Command |
|---|---|
| Code | `git revert <merge-sha>` — next push redeploys the previous build. |
| Pages direct | `wrangler pages deployments rollback <deployment-id>` (Cloudflare dashboard → Pages → Deployments → ⋯ → Rollback). |

Backend deploy is unaffected by frontend rollback — they are separate jobs on the same workflow.

## 11. Local development

```bash
# Install
cd frontend
npm install

# Dev server (HMR)
npm run dev   # http://localhost:5173

# Build
npm run build # outputs dist/

# Test
npm test               # vitest run
npm run test:coverage  # coverage report
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run e2e            # playwright (requires VITE_BASE_URL)
```

Required env (Vite auto-loads `.env.local`):

```
VITE_API_BASE_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com
VITE_COGNITO_USER_POOL_CLIENT_ID=<user-pool-client-id>
VITE_COGNITO_REGION=us-east-1
```

## 12. Test commands

| Surface | Command |
|---|---|
| Frontend unit + integration | `cd frontend && npm test` |
| Frontend coverage | `cd frontend && npx vitest run --coverage` |
| Frontend e2e | `cd frontend && npx playwright test` (requires `VITE_BASE_URL`) |
| Backend | `cd backend && npx vitest run` |
| All | `npm test` from the repo root runs both (per `openspec/config.yaml`). |

## 13. Open follow-ups

- [ ] Production Cloudflare custom domain (currently on `*.pages.dev`).
- [ ] Playwright admin user-management spec (PR5 ships only the auth + 403 specs).
- [ ] Recharts integration for category breakdown (originally planned for PR4).
- [ ] PapaParse CSV import (originally planned for PR5).
- [ ] Bundle splitting if initial JS exceeds 200 kB gzipped (current: ~93 kB gzipped per PR4 build).

## 14. CORS configuration

### 14.1 Threat model

`Access-Control-Allow-Origin: *` combined with the `Authorization` header is a security anti-pattern: any third-party site running in a user's browser can issue `fetch('https://api/...', { credentials: 'include' })` with a stolen token and the browser will accept the response. The fix is to scope the allow-list to the actual frontend origins (the Cloudflare Pages domain for production, `http://localhost:5173` for local Vite dev). The API Gateway preflight and the Lambda response both enforce the same allow-list so an attacker who manages to bypass one is still blocked at the other.

### 14.2 Origin allow-list flow

There are two independent surfaces, both seeded from the same default list `('https://finance-coach-latam.pages.dev', 'http://localhost:5173')`:

| Surface | Source | Where to override |
|---|---|---|
| API Gateway v2 preflight (OPTIONS) | `infra/lib/finance-coach-stack.ts` reads CDK context `allowedOrigins` | `cdk deploy -c allowedOrigins=https://staging.example.com,https://prod.example.com` |
| Lambda response (GET/POST/PATCH/DELETE) | `backend/src/infrastructure/config/env.config.ts` reads `ALLOWED_ORIGINS` env var | `ALLOWED_ORIGINS` on `ApiFunction` / `HealthHandler` / `MigrationFunction` in CDK `environment` block |

Keep both lists in sync. If only one surface is updated the browser will see inconsistent preflight vs response and reject the call.

### 14.3 Adding a new origin

1. Decide the new origin (must include scheme, e.g. `https://staging.example.com`).
2. For staging/prod, set the CDK context at deploy time:
   ```bash
   npx cdk deploy -c allowedOrigins=https://finance-coach-latam.pages.dev,https://staging.example.com,http://localhost:5173
   ```
3. For the Lambda response side, add the same origin to the `ALLOWED_ORIGINS` env var on every Lambda (`ApiFunction`, `HealthHandler`, `MigrationFunction`, `CategorizerFunction`) in `infra/lib/finance-coach-stack.ts`. The env var is a comma-separated CSV that is trimmed, de-duplicated, and validated at startup (`parseAllowedOrigins` rejects empty entries and any value without an `http(s)://` scheme).
4. Redeploy and re-verify per §14.4.

### 14.4 Verifying in a browser

Open the SPA, then in DevTools → Network click any API request → check the response headers:

```
Access-Control-Allow-Origin: https://finance-coach-latam.pages.dev
Vary: Origin
```

For an unknown origin (simulate by editing the `Origin` header in a curl preflight):

```bash
curl -i -X OPTIONS https://<api>.execute-api.us-east-1.amazonaws.com/health \
  -H "Origin: https://attacker.example" \
  -H "Access-Control-Request-Method: GET"
```

The response MUST NOT include `Access-Control-Allow-Origin` (the browser will refuse the actual response).

### 14.5 Recovery — accidentally reverting to `*`

If you suspect a regression, grep both surfaces from the repo root:

```bash
grep -RnE "Access-Control-Allow-Origin.*['\"]?\*['\"]?" backend/src infra/lib
grep -RnE "allowOrigins.*\*" infra/lib
```

The only acceptable matches after this fix landed are:

- `backend/src/interfaces/http/http.utils.ts` — the comment block explaining why `*` is wrong.
- `backend/src/interfaces/http/cors.test.ts` — the test asserting `*` is never returned.

Any other match is a regression: revert it, re-run `cdk synth`, and add a failing test first (TDD).

### 14.6 Local dev proxy

`frontend/vite.config.ts` adds a dev-only `server.proxy['/api'] → http://localhost:3000` so `npm run dev` works without the SPA ever hitting the production CORS allow-list. Production goes through Cloudflare Pages → API Gateway directly.

## 15. SPA endpoint surface (`frontend-flow-completion`, shipped via PRs #40 + #41 + #42)

The SPA now exercises every backend CRUD endpoint that was previously only available to seeded admin tooling. URL construction goes through `joinUrl()` (`frontend/src/services/url.ts`) — no `${baseUrl}/path}` template strings remain. Every hook in `frontend/src/hooks/` routes its outgoing URL through the helper and is covered by MSW tests that assert a single-slash URL.

### 15.1 Endpoints consumed

| Method + path | Caller | Auth | Notes |
|---|---|---|---|
| `GET /categories` | `useCategories`, `SpendDonut`, `InsightsPage` | Bearer (any role) | Slice colors come from `color` field |
| `POST /categories` | `CategoriesAdminPage` | Bearer admin | Returns 201 |
| `PATCH /categories/{id}` | `CategoriesAdminPage` | Bearer admin | Triggers async embedding recompute |
| `DELETE /categories/{id}` | `CategoriesAdminPage` | Bearer admin | 409 when transactions reference it |
| `GET /accounts` | `useAccounts`, `TransactionForm` | Bearer (owner or admin via `?userId=`) | Pagination cap = 100 |
| `POST /accounts` | `AccountForm` | Bearer (any role) | `type ∈ {BANK, CASH, CARD}` |
| `GET /users` | `useUsers` | Bearer admin | Non-admin never mounts (router `RequireRole`) |
| `POST /users` | `UserForm` | Bearer admin | `tier ∈ {BRONZE, SILVER, GOLD}` |
| `GET /transactions` | `useTransactions`, `DashboardPage`, `InsightsPage` | Bearer (owner or admin via `?userId=`) | Default `limit=50`, max 100 |
| `POST /transactions` | `TransactionForm` | Bearer (any role) | New row starts `status: PENDING` |
| `POST /transactions/{id}/categorize` | `useRecategorizeTransaction` (Recategorize button) | Bearer (any role) | Async LLM pipeline |
| **`PATCH /transactions/{id}`** *(new)* | `CategorySelect` dropdown override | Bearer (owner or admin) | Owner-or-admin authz runs **after** load; spoofed `userId` in body is rejected |

The PATCH row is the only contract addition in this cycle. CDK is unchanged because `PATCH` and `DELETE` were widened on the API Gateway CORS preflight in `phase-6-categories-crud-patch-delete`.

### 15.2 Build-time env vars

| Var | Required | Source | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | yes | GitHub Actions / `.env.local` | Fails fast at module load when missing (PR #37). Format: `https://<api-id>.execute-api.us-east-1.amazonaws.com` |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | yes | GitHub secret | Safe defaults applied when unset in dev |
| `VITE_COGNITO_REGION` | yes | GitHub secret (`AWS_REGION`) | Safe defaults applied when unset in dev |

`.env.example` documents the full template. CI fails the build when `VITE_API_BASE_URL` is empty, so a missing URL never reaches production.

### 15.3 Role-based route visibility

| Route | `user` | `admin` | Guard |
|---|---|---|---|
| `/dashboard` | ✓ | ✓ | `RequireAuth` |
| `/transactions` | ✓ | ✓ | `RequireAuth` (admin can pass `?userId=`) |
| `/accounts` | ✓ | ✓ | `RequireAuth` (admin can pass `?userId=`) |
| `/insights` | ✓ | ✓ | `RequireAuth` |
| `/categories` | ✗ | ✓ | `RequireRole('admin')` |
| `/admin/users` | ✗ | ✓ | `RequireRole('admin')` |

The sidebar renders only the links the current role can access. Non-admin attempts to load an admin route render `ForbiddenPage` and the page never fires its data-fetch hooks.

### 15.4 Known follow-ups

| ID | Severity | Issue | Tracking |
|---|---|---|---|
| F1 | WARNING | **Cloudflare Pages preview CORS gap.** `feat-*.finance-coach-latam.pages.dev` preview URLs are NOT in the API Gateway or Lambda CORS allow-list. PR preview deployments will hit CORS rejection until the Lambda-side origin validator is widened to support `*.finance-coach-latam.pages.dev` patterns (see §14 for the allow-list flow). | Future change. Local dev and production URL are unaffected. |
| F2 | WARNING | **FormField `required` forwarding bug.** `frontend/src/molecules/FormField.tsx` consumes the `required` prop but does NOT forward it to the underlying `<Input>` atom — it only renders the `*` indicator in the Label. HTML5 constraint validation never triggers on FormField-wrapped inputs. Custom form validation compensates today; recommended fix is to forward `required` plus `aria-required`, `aria-invalid`, `min`, `max`, `pattern` to the underlying input. | Future change. Custom validation prevents user-visible regressions. |
| F3 | WARNING | **InsightsPage Δ% / Δ abs columns stubbed to 0.** `InsightsPage.tsx` lines 113–139 set `deltaPct` and `deltaAbs` to `0` because no comparison window is computed. The sortable breakdown table renders these stubs; backfilling the month-over-month comparison requires a date-range query that is currently out of scope. | Future change. |
| F4 | WARNING | **Page-level integration tests missing for 5 pages.** `TransactionsPage`, `AccountsPage`, `UsersAdminPage`, `DashboardPage`, `InsightsPage` lack dedicated page-level integration tests. Underlying hooks and organisms are covered, but the page orchestration (loading/empty/error states, route-level guards, mock-only navigation) is not exercised end-to-end. Unit-level coverage exceeds the per-glob 80% threshold. | Future change. |
| F5 | WARNING | **AmountText locale test is locale-tolerant.** `AmountText.test.tsx:17` uses `/12[.,]34/` regex because the runtime locale may default to `en-US` in jsdom. Spec REQ-FFC-TX-AMOUNT-DISPLAY explicitly requires `8.500,00 ARS` for `es-AR`; recommended fix is to pin the test fixture locale. | Future change. |
| F6 | SUGGESTION | **Recharts split into 3 chunks.** `CategoricalChart-iEvTJM8V.js` (94.23 KB gz) + `MonthlySparkline-FhcSfjY_.js` (14.34 KB gz) + `SpendDonut-Cxl1qYBy.js` (6.42 KB gz) = 114.99 KB total. Could consolidate to a single chart bundle. | Future change. |
| F7 | SUGGESTION | **Two `react-refresh/only-export-components` warnings** in `frontend/src/app/router.tsx` from the `RequireAuth` / `RequireRole` extraction. Non-blocking (exit 0). | Future change. |