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

The backend API Gateway HTTP API v2 has `Access-Control-Allow-Origin: *`. Any site on the internet can call the API with a valid token. Bounded by:

- Cognito free tier (50K MAU)
- API Gateway throttle (100 RPS)

**Acceptable for the portfolio demo.** Do **not** ship this posture to a production multi-tenant system without scoping origins to the Pages domain.

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