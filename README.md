# Finance Coach LATAM

Personal finance assistant for LATAM users. AI-powered transaction categorization, semantic duplicate detection, and personalized insights.

This is a **portfolio flagship** for a senior backend/cloud engineer. Built to demonstrate hexagonal architecture, SOLID principles, serverless AWS, and free-tier cost discipline on real infrastructure.

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
| LLM (Phase 2) | Gemini 1.5 Flash + text-embedding-004 (free tier) |
| Frontend hosting | Cloudflare Pages |

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

| Phase | Scope | Why |
|---|---|---|
| **Foundation (now)** | Health-check entity, 2 use cases, Lambda + Neon + Drizzle connectivity | Verify the production plumbing. Foundation code is not throwaway. |
| **Phase 1** | Full domain — Transactions, Categories, Accounts, Users. REST CRUD. | Build the product skeleton on the health foundation. |
| **Phase 2** | Cognito (2 roles: admin/user), EventBridge, SQS, categorizer worker with Gemini Flash + text-embedding-004, seed Lambda with 500 fake ARS/USD transactions. | Auth, async jobs, realistic data, and provider-backed categorization. |
| **Phase 3** | Strict TDD coverage and semantic duplicate-detection workflows. | Harden the product and expand its core AI value. |
| **Phase 4** | React frontend on Cloudflare Pages, CI/CD via GitHub OIDC. | Ship to users. |

---

## Architectural Discipline

- **Hexagonal** means the domain is inviolable. Tomorrow's `PostgresLocalAdapter` or `DynamoDbAdapter` drops in without touching use cases.
- **Composition root** (`main.ts`) is the ONLY file that knows concrete adapter types. Everything else depends on interfaces.
- **No `process.env.X` outside `env.config.ts`.** All env access goes through the typed config object.
- **No tests yet** — added in Phase 3 with strict TDD. The health endpoint currently validates infrastructure connectivity.

---

## Cost Discipline

- Neon free tier: 0.5 GB storage, 190 compute hours/month.
- Lambda free tier: 1M requests/month, 400k GB-seconds.
- API Gateway HTTP API: 1M requests/month for first 12 months.
- Dormant resources: Neon scales to zero after 5 min idle. Lambda costs nothing when idle. **Net cost: $0/month for normal demo usage.**
