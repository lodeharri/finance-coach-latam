# Finance Coach LATAM

Personal finance assistant for LATAM users. AI-powered transaction categorization, semantic duplicate detection, and personalized insights.

This is a **portfolio flagship** for a senior backend/cloud engineer. Built to demonstrate hexagonal architecture, SOLID principles, serverless AWS, and free-tier cost discipline on real infrastructure.

---

## 📋 Specification (OpenSpec)

The full Spec-Driven Development artifacts live under [`openspec/changes/initial-poc/`](./openspec/changes/initial-poc/):

- [`proposal.md`](./openspec/changes/initial-poc/proposal.md) — Problem, scope, success metrics, risks
- [`spec.md`](./openspec/changes/initial-poc/spec.md) — Requirements with Given/When/Then scenarios (R1–R10)
- [`design.md`](./openspec/changes/initial-poc/design.md) — Architecture diagram, components, ADRs (Hexagonal, Custom Resource, Drizzle, Gemini, RBAC)
- [`tasks.md`](./openspec/changes/initial-poc/tasks.md) — Implementation tasks with `[x]` / `[ ]` checkboxes (62% complete)

**Status:** Phases 1–4 complete (40/65 tasks). Phases 5–7 pending production validation, frontend, and CI/CD.

---

## Folder Structure

```
finance-coach-latam/
├── backend/          # Node 24 + TypeScript + esbuild. Hexagonal (domain/application/infrastructure/interfaces).
├── frontend/         # React 18 + Vite + TS + Tailwind + Recharts. Atomic Design (placeholder for Phase 2).
├── infra/            # AWS CDK v2 (TypeScript), single stack, region us-east-1.
├── .atl/             # Skill registry cache (internal tooling).
└── README.md
```

### Backend Layout (hexagonal)

```
backend/src/
├── domain/                          # Pure business logic. Zero external deps.
│   ├── entities/                    # Domain entities.
│   └── ports/                       # Interfaces (DatabasePort, LLMPort).
├── application/                     # Use cases. Depend only on domain ports.
│   └── use-cases/
├── infrastructure/                  # Concrete adapters. Implements domain ports.
│   ├── database/drizzle/            # Drizzle schema.
│   └── config/                      # Typed env loader.
├── interfaces/                      # HTTP entry points.
│   └── http/
└── main.ts                          # Composition root. The ONLY place that wires concrete adapters.
```

**Dependency rules**: `domain` → nothing · `application` → `domain/ports` only · `infrastructure` → implements `domain/ports` · `interfaces` → calls `application` use cases · `main.ts` composes everything.

---

## Stack (locked)

| Layer | Choice |
|---|---|
| Runtime | Node 24.x, TypeScript, bundled with esbuild |
| Database | Neon Postgres free tier (0.5 GB) |
| ORM | Drizzle with `drizzle-orm/neon-http` (HTTPS, no VPC) |
| API | API Gateway HTTP API v2 |
| IaC | AWS CDK v2 (TypeScript) |
| Region | `us-east-1` |
| Lambda | 512 MB / 10 s |
| LLM | Gemini 2.0 Flash + text-embedding-004 (free tier) |
| Auth | Amazon Cognito User Pool (2 roles: admin + user, JWT authorizer) |
| Frontend hosting | Cloudflare Pages (Phase 6) |

**Free tier only.** Zero ongoing cost in normal demo usage.

---

## Health Foundation Deploy Steps

The health endpoint verifies AWS Lambda can talk to Neon Postgres through Drizzle while preserving the hexagonal architecture. One entity (`health_check`), two use cases, two HTTP routes.

### 1. Create a Neon project

1. Sign up at <https://neon.tech>.
2. Create a new project (region: AWS US East — closest to `us-east-1`).
3. Copy the connection string. It looks like:
   ```
   postgres://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# Paste your DATABASE_URL into .env
```

### 3. Run migrations

```bash
npm run db:generate
npm run db:migrate
```

### 4. Build backend

```bash
npm run build
```

This produces `backend/dist/health/handler.js` — the artifact CDK will bundle.

### 5. Deploy infrastructure

```bash
cd ../infra
npm install
cp .env.example .env
# Fill in the values, then load them into the CDK process.
set -a && source .env && set +a
npx cdk bootstrap
npx cdk deploy
```

CDK will print the API URL in the output. Test it:

```bash
# POST a row
curl -X POST <API_URL>/health -H "Content-Type: application/json" -d '{"name":"hello"}'

# GET all rows
curl <API_URL>/health
```

---

## Phases Roadmap

For current status see [tasks.md](./openspec/changes/initial-poc/tasks.md). Summary:

- ✅ **Phase 1 — POC foundation** (13/13): hexagonal backend, health endpoint, CDK deploy
- ✅ **Phase 2 — DB lifecycle** (7/7): Custom Resource for migrations + seed
- ✅ **Phase 3 — GitHub repo** (6/6): public `lodeharri/finance-coach-latam`
- ✅ **Phase 4 — Domain entities + auth** (14/14): User/Account/Category/Transaction + Cognito + Gemini
- 🔜 **Phase 5 — Production validation** (0/9): deploy Phase 4, verify all spec scenarios end-to-end
- 🔜 **Phase 6 — Frontend + polish** (0/11): React SPA, Cloudflare Pages, case-study.md, runbook.md
- 🔜 **Phase 7 — CI/CD** (0/5): GitHub Actions with OIDC

---

## Architectural Discipline

- **Hexagonal** means the domain is inviolable. Tomorrow's `PostgresLocalAdapter` or `DynamoDbAdapter` drops in without touching use cases.
- **Composition root** (`main.ts` and `lambdas/{name}/composition.ts`) is the ONLY place that wires concrete adapter types. Everything else depends on interfaces.
- **No `process.env.X` outside `env.config.ts`.** All env access goes through the typed config object.
- **CloudFormation Custom Resource** wires migrations into the deploy lifecycle — no manual `npm run db:migrate` ever.
- **Tests** — 29 Vitest tests across 10 files (100% coverage on `src/application/use-cases/`). Run with `cd backend && npm test`.

---

## Cost Discipline

- Neon free tier: 0.5 GB storage, 190 compute hours/month.
- Lambda free tier: 1M requests/month, 400k GB-seconds.
- API Gateway HTTP API: 1M requests/month for first 12 months.
- Dormant resources: Neon scales to zero after 5 min idle. Lambda costs nothing when idle. **Net cost: $0/month for normal demo usage.**
