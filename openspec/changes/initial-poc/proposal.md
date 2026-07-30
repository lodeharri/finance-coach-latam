# Initial POC — Personal Finance Coach for LATAM

> Change: `initial-poc` — the foundational change that establishes the project, validates infrastructure, and ships the first domain features.

## Problem

LATAM users lack accessible personal finance tools that understand local context: ARS/USD multi-currency realities, inflation awareness, regional merchants (Café Martínez, Shell AR, MercadoPago, etc.), and Spanish-first UX. Existing global tools (Mint, YNAB, Personal Capital) either do not serve the region or miss local patterns. The few LATAM-native options (Fintual, GuBolso) are narrow in scope.

## Why

Portfolio flagship for a senior backend/cloud engineer role. Demonstrates hexagonal architecture, SOLID principles, AWS serverless, free-tier cost discipline, and AI integration with production patterns (CloudFormation Custom Resource for DB lifecycle, swappable LLM/DB adapters, programmatic Drizzle migrations).

## Scope (in)

**POC infrastructure (deployed, working):**

- AWS Lambda Node 24 + API Gateway HTTP API v2
- Neon Postgres free tier + Drizzle ORM with `neon-http` driver (no VPC, no NAT)
- CloudFormation Custom Resource for automated migrations + idempotent seed
- Hexagonal backend: shared `domain/` / `application/` / `infrastructure/` / `interfaces/` layers + per-Lambda entry points
- `DatabasePort` and `LLMPort` interfaces with swappable adapters (Neon, Gemini, future OpenAI)
- Vitest 2.x with 8 tests on initial use cases (100% coverage on `application/use-cases/`)
- Public GitHub repo `lodeharri/finance-coach-latam` with conventional commits
- Two demo users: `admin@portfolio.dev`, `user@portfolio.dev` (admin + user roles)

**Phase 2 domain features (in progress, partially implemented):**

- Entities: `User`, `Account`, `Category`, `Transaction`
- Cognito User Pool with 2 pre-created users (admin + user), permanent passwords, group membership
- Cognito JWT Authorizer on all routes except `/health` (liveness probe stays public)
- 6+ use cases: `CreateUser`, `ListUsers`, `CreateAccount`, `ListAccountsByUser`, `ListCategories`, `CreateTransaction`, `ListTransactionsByUser`, `CategorizeTransaction`
- Real Gemini Flash integration for transaction categorization (`generateText` + `embed`)
- Programmatic Drizzle migrator + idempotent seed extended with categories + accounts + 50 sample transactions
- 21 new Vitest tests (29 total)

## Non-goals (out)

- Real bank integrations (Plaid, Belvo) — manual CSV upload sufficient for POC
- Multi-currency live conversion — store amounts in integer cents, single currency per user
- Push/email/SMS notifications — CloudWatch logs only
- Mobile app — web SPA only
- Multi-region — single region (`us-east-1`) only
- Multi-tenant — single-tenant demo
- i18n UI — Spanish-first, English fallback not required
- Paid Gemini tier — free tier (15 RPM, 1,500 RPD, 1M tokens/min)
- Hosted UI redirects — direct API authentication with JWT in `Authorization` header

## Success metrics

| Metric | Target | Status |
|---|---|---|
| Deploy within AWS Free Tier | <$5/month, ideally $0 | ✅ Achieved (Lambda + DynamoDB-free + Neon free tier) |
| Custom Resource runs migrations on every deploy | Idempotent, audit trail | ✅ Verified |
| Hexagonal layers (domain/app/infra/interfaces) | Zero coupling, swappable adapters | ✅ Verified |
| Vitest coverage on use cases | ≥70% | ✅ 100% |
| Public GitHub repo with conventional commits | Yes | ✅ `lodeharri/finance-coach-latam` |
| Cognito login works with 2 pre-seeded users | Yes | 🔄 Phase 2 (pending) |
| Gemini categorizes a transaction in <2s | Yes | 🔄 Phase 2 (pending) |
| Demo URL accessible 24/7 without login | Yes | ✅ `/health` (unauthenticated) |

## Risks

| Risk | Mitigation |
|---|---|
| Gemini free-tier quota exhausted under demo load | Frontend rate limit (1 req/5s per user) + response cache |
| Neon free-tier storage cap (0.5 GB) | Demo data stays well under cap (estimated <50 MB with seed) |
| Lambda 2-minute timeout for migrations | Increase to 5 minutes if needed; large migrations break stack (acceptable trade-off) |
| Cognito cost overruns | Free tier covers 50K MAU — sufficient for portfolio traffic |
| Cross-region latency (Lambda `us-east-1` → Neon `us-east-2`) | ~50ms added; acceptable for demo |