# Tasks — initial-poc

> Conventions: `[x]` = completed, `[ ]` = pending. Tasks are listed in dependency order. The bottom section ("Pending") is the explicit roadmap for the rest of Phase 2 and Phase 3.

## Phase 1 — POC foundation (infrastructure validation)

- [x] **1.1** Initialize project structure: `backend/`, `frontend/`, `infra/`, `.atl/`
- [x] **1.2** Bootstrap AWS CDK v2 project with TypeScript, esbuild bundler
- [x] **1.3** Bootstrap hexagonal Node 24 + TypeScript backend
- [x] **1.4** Define Drizzle schema for `health_check` table (POC placeholder)
- [x] **1.5** Define `DatabasePort` interface with `TableRef<T>` brand type
- [x] **1.6** Implement `NeonDatabaseAdapter` (implements `DatabasePort`)
- [x] **1.7** Implement `RecordHealthCheckUseCase` and `ListHealthChecksUseCase`
- [x] **1.8** Implement HTTP handlers (`health.routes.ts`, `health.handler.ts`)
- [x] **1.9** Implement composition root (`main.ts`)
- [x] **1.10** Configure esbuild: 2 bundles (health + migration), copies `drizzle/` folder
- [x] **1.11** CDK stack: `HealthHandler` Lambda + HTTP API v2 + CORS
- [x] **1.12** Vitest 2.x with 8 use-case tests (mocked `DatabasePort`)
- [x] **1.13** First deploy to AWS — verified end-to-end with curl

## Phase 2 — DB lifecycle automation (Custom Resource)

- [x] **2.1** Implement `MigrationFunction` Lambda + composition root
- [x] **2.2** Implement programmatic Drizzle migrator (`migrate.ts`)
- [x] **2.3** Implement idempotent seed (`seed.ts`) with initial data
- [x] **2.4** Implement CloudFormation Custom Resource handler (`handler.ts`)
- [x] **2.5** Wire Custom Resource into CDK stack with `cr.Provider`
- [x] **2.6** Add `node.addDependency()` so `HealthHandler` waits for migration success
- [x] **2.7** Validate: drop tables in Neon → `cdk deploy` → tables recreated + seeded

## Phase 3 — GitHub repository

- [x] **3.1** Initialize local git repository
- [x] **3.2** Fix git config email typo (`gmailcom` → `gmail.com`)
- [x] **3.3** Stage 44 files (verified no `.env` secrets)
- [x] **3.4** Create public GitHub repo `finance-coach-latam`
- [x] **3.5** Push initial commit with conventional message (`feat: initial POC ...`)
- [x] **3.6** Set repo topics and homepage URL

## Phase 4 — Domain entities + auth (Phase 2 implementation)

- [x] **4.1** Add Drizzle schema for `user`, `account`, `category`, `transaction` tables
- [x] **4.2** Generate migration `0001_youthful_salo.sql`
- [x] **4.3** Add domain entity TypeScript types
- [x] **4.4** Add `AuthPort` and `CognitoPort` interfaces
- [x] **4.5** Implement `CognitoIdentityAdapter` (uses `@aws-sdk/client-cognito-identity-provider`)
- [x] **4.6** Implement `JwtVerifierAdapter` (Cognito JWKS verification)
- [x] **4.7** Implement real `GeminiLLMAdapter` (was skeleton; now uses `gemini-2.0-flash` + `text-embedding-004`)
- [x] **4.8** Add 8 new use cases with authorization checks (`assertCanActAs` helper)
- [x] **4.9** Add HTTP routes: `users`, `accounts`, `categories`, `transactions`
- [x] **4.10** Update bootstrap Lambda to create 2 Cognito users with permanent passwords
- [x] **4.11** Update CDK stack: Cognito User Pool + JWT Authorizer + `ApiHandler` Lambda
- [x] **4.12** Configure `/health` route with `HttpNoneAuthorizer` to remain public
- [x] **4.13** Add 21 new Vitest tests (29 total now, 100% coverage on use cases)
- [x] **4.14** Update seed: 8 categories + 1 demo account + 50 sample transactions

## Phase 5 — Production validation (Pending)

- [ ] **5.1** `cdk deploy` with the Phase 4 stack — verify Cognito User Pool created
- [ ] **5.2** Verify bootstrap Lambda creates 2 Cognito users + assigns to groups
- [ ] **5.3** Test login flow: `user@portfolio.dev` / `Demo#2026!` returns JWT
- [ ] **5.4** Test authenticated `GET /categories` returns 8 rows
- [ ] **5.5** Test `POST /transactions` persists with `status: 'PENDING'`
- [ ] **5.6** Test `POST /transactions/{id}/categorize` calls Gemini and updates `categoryId`
- [ ] **5.7** Test admin-only routes reject non-admin tokens (HTTP 403)
- [ ] **5.8** Cross-account write test: user A tries to write to user B's account → 403
- [ ] **5.9** Verify Gemini rate-limit fallback (cache + retry)

## Phase 6 — Frontend + polish (Pending)

- [ ] **6.1** Bootstrap React 18 + Vite + Tailwind frontend (Atomic Design)
- [ ] **6.2** Atoms: Button, Input, Label, Card, Badge
- [ ] **6.3** Molecules: FormField, TransactionRow, CategoryBadge
- [ ] **6.4** Organisms: TransactionList, CategoryBreakdown, LoginForm
- [ ] **6.5** Templates: DashboardLayout, AuthLayout
- [ ] **6.6** Pages: Overview, Dashboard, EventTimeline (3 main routes)
- [ ] **6.7** Integrate Cognito login flow with JWT in `Authorization` header
- [ ] **6.8** Deploy frontend to Cloudflare Pages
- [ ] **6.9** Write `docs/case-study.md` (1-page portfolio narrative)
- [ ] **6.10** Write `docs/security.md` (threat model + secrets rotation)
- [ ] **6.11** Write `docs/runbook.md` (DLQ alarm response + stack destroy procedure)

## Phase 7 — CI/CD (Pending)

- [ ] **7.1** `lint-test.yml` — ESLint + Prettier + Vitest on every PR
- [ ] **7.2** `cdk-synth.yml` — `cdk synth` + diff comment on every PR
- [ ] **7.3** `deploy.yml` — `cdk deploy` on push to `main` via GitHub OIDC
- [ ] **7.4** `cost-check.yml` — daily `aws ce get-cost-and-usage` check
- [ ] **7.5** Frontend deploy workflow (Cloudflare Pages via `wrangler`)

---

## Summary

| Phase | Tasks | Completed | Pending |
|---|---:|---:|---:|
| 1. POC foundation | 13 | 13 | 0 |
| 2. DB lifecycle | 7 | 7 | 0 |
| 3. GitHub repo | 6 | 6 | 0 |
| 4. Domain entities | 14 | 14 | 0 |
| 5. Production validation | 9 | 0 | 9 |
| 6. Frontend + polish | 11 | 0 | 11 |
| 7. CI/CD | 5 | 0 | 5 |
| **Total** | **65** | **40 (62%)** | **25 (38%)** |

**Coverage check:** Vitest run at the end of Phase 4 reports 100% statements / 100% branches / 100% functions / 100% lines on `src/application/use-cases/`.

**Known limitations to flag in PR description / case study:**

- Gemini free tier can be exhausted by viral traffic — frontend must rate-limit
- Cross-region latency (Lambda `us-east-1` → Neon `us-east-2`) adds ~50ms
- Cognito JWT verification uses JWKS endpoint on each request (no in-memory cache; can be optimized)
- Bootstrap Lambda runs as admin (uses its own IAM role) — production should use a dedicated admin service principal
- No retry/circuit-breaker on Gemini calls yet — transient failures should fall back to `FAILED` status, which is the current behavior