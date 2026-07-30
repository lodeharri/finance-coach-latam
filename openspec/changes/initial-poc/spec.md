# Specification — Personal Finance Coach for LATAM

> Delta spec for `initial-poc`. Each requirement is a SHALL statement with at least one Given/When/Then scenario.

## R1 — Authentication & Authorization

### R1.1 The system SHALL authenticate requests via Amazon Cognito JWT tokens

- **Given** a request to any protected route with a valid Cognito JWT in the `Authorization: Bearer` header
- **When** the request reaches the API Gateway HTTP API v2 with Cognito Authorizer
- **Then** the request is forwarded to the Lambda handler with the JWT claims (`sub`, `email`, `cognito:groups`) available

### R1.2 The system SHALL reject unauthenticated requests to all routes except `/health` with HTTP 401

- **Given** any protected route (`/users`, `/accounts`, `/categories`, `/transactions`, etc.)
- **When** a request arrives without an `Authorization` header or with an invalid JWT
- **Then** API Gateway returns HTTP 401 without invoking the Lambda

### R1.3 The system SHALL support two roles: `admin` and `user`

- **Given** a Cognito User Pool with two groups: `admins` and `users`
- **When** an admin user (member of `admins` group) makes a request
- **Then** the request is allowed to access admin-only routes (`POST /users`, `GET /users`)

- **Given** a non-admin user (member of `users` group only)
- **When** the user attempts to access `POST /users`
- **Then** the request is rejected with HTTP 403

## R2 — User management

### R2.1 Admin users SHALL be able to create new users via `POST /users`

- **Given** an authenticated admin with `Authorization: Bearer <jwt>`
- **When** the admin sends `POST /users` with body `{email, name, role: 'user' | 'admin'}`
- **Then** the system calls Cognito `AdminCreateUser`, adds the user to the corresponding group, persists the user row, and returns 201 with `{id, email, name, role, createdAt}`

### R2.2 Non-admin users SHALL NOT be able to create users (HTTP 403)

- **Given** an authenticated user (role `user`, not admin)
- **When** the user sends `POST /users`
- **Then** the system returns HTTP 403 with body `{error: 'forbidden'}`

### R2.3 Admin users SHALL be able to list all users via `GET /users`

- **Given** an authenticated admin
- **When** the admin sends `GET /users`
- **Then** the system returns 200 with `{users: [{id, email, name, role, createdAt}, ...]}`

## R3 — Accounts

### R3.1 Authenticated users SHALL be able to create accounts via `POST /accounts`

- **Given** an authenticated user (any role) with valid JWT
- **When** the user sends `POST /accounts` with body `{name, type: 'BANK' | 'CASH' | 'CARD'}`
- **Then** the system persists the account linked to the JWT subject and returns 201 with `{id, userId, name, type, createdAt}`

### R3.2 Authenticated users SHALL be able to list their own accounts via `GET /accounts`

- **Given** an authenticated user
- **When** the user sends `GET /accounts`
- **Then** the system returns 200 with `{accounts: [<only user's accounts>]}`

- **Given** an authenticated admin
- **When** the admin sends `GET /accounts`
- **Then** the admin sees all accounts in the system (admin override)

## R4 — Categories

### R4.1 All authenticated users SHALL be able to list all categories via `GET /categories`

- **Given** any authenticated user
- **When** the user sends `GET /categories`
- **Then** the system returns 200 with `{categories: [<all 8 categories from seed>]}`

### R4.2 Categories SHALL be predefined and seeded by the bootstrap Lambda

- **Given** the bootstrap Lambda runs on first deploy
- **When** the seed phase executes
- **Then** the categories table contains exactly 8 rows: `alimentos`, `transporte`, `entretenimiento`, `servicios`, `compras`, `salud`, `educacion`, `otros`

## R5 — Transactions

### R5.1 Authenticated users SHALL be able to create transactions via `POST /transactions`

- **Given** an authenticated user
- **When** the user sends `POST /transactions` with body `{accountId, merchant, amountCents, occurredAt, notes?}`
- **Then** the system persists the transaction linked to the user, status `PENDING`, and returns 201 with `{id, userId, accountId, merchant, amountCents, occurredAt, status, createdAt}`

### R5.2 The system SHALL validate that the referenced account belongs to the authenticated user

- **Given** an authenticated user with JWT subject `user-123`
- **When** the user sends `POST /transactions` with `accountId` belonging to `user-456`
- **Then** the system returns HTTP 403 (no cross-account writes allowed; admin override permitted)

### R5.3 Authenticated users SHALL be able to list their own transactions via `GET /transactions`

- **Given** an authenticated user
- **When** the user sends `GET /transactions`
- **Then** the system returns 200 with `{transactions: [<only user's transactions, ordered by occurredAt desc>]}`

### R5.4 The system SHALL categorize transactions using Gemini Flash

- **Given** a transaction with status `PENDING` and merchant string
- **When** `POST /transactions/{id}/categorize` is called
- **Then** the system calls Gemini Flash with the merchant string, parses the category suggestion, updates the transaction with `categoryId` and `status: 'CATEGORIZED'`, returns 200 with the updated transaction

### R5.5 Failed categorizations SHALL mark the transaction as `FAILED`

- **Given** a transaction with status `PENDING`
- **When** the Gemini API call fails (rate limit, network error, parse error)
- **Then** the transaction status is updated to `FAILED` and an error response is returned

## R6 — Health check (liveness probe)

### R6.1 The `/health` endpoint SHALL be publicly accessible without authentication

- **Given** any anonymous request
- **When** the request hits `GET /health` or `POST /health`
- **Then** the request is processed without Cognito JWT validation

### R6.2 The `POST /health` endpoint SHALL persist a row with a non-empty name

- **Given** a `POST /health` with body `{name: 'hello'}`
- **When** the request reaches the HealthHandler Lambda
- **Then** the system persists a row in the `health_check` table and returns 201

### R6.3 The `GET /health` endpoint SHALL return all health check rows

- **Given** at least one row in the `health_check` table
- **When** a `GET /health` request arrives
- **Then** the system returns 200 with `{healthChecks: [<all rows>]}`

## R7 — Database lifecycle (CloudFormation Custom Resource)

### R7.1 The system SHALL run Drizzle migrations automatically on every deploy

- **Given** a `cdk deploy` is executed
- **When** CloudFormation reaches the `MigrateAndSeed` Custom Resource
- **Then** the `MigrationFunction` Lambda runs `drizzle-orm/neon-http/migrator` and applies any pending migrations to Neon

### R7.2 The system SHALL NOT create the HealthHandler Lambda until migration succeeds

- **Given** the stack has `node.addDependency()` from `HealthHandler` → `MigrateAndSeed`
- **When** CloudFormation orchestrates the stack
- **Then** `HealthHandler` and `FinanceCoachHttpApi` are created only after `MigrateAndSeed` returns `SUCCESS`

### R7.3 If the migration fails, the system SHALL roll back the entire stack

- **Given** the migration Lambda throws an exception
- **When** CloudFormation receives the `FAILED` response
- **Then** CloudFormation rolls back the stack to its previous state (no orphaned resources)

### R7.4 The seed SHALL be idempotent across multiple deploys

- **Given** the seed phase runs on first deploy (inserts 1 seed row)
- **When** the seed phase runs on the second deploy
- **Then** the seed query-first check finds the existing row and skips the insert (no duplicates)

### R7.5 Cognito users SHALL be created (or verified) on every deploy

- **Given** the bootstrap phase extends to Cognito user creation
- **When** the migration Lambda runs (both Create and Update events)
- **Then** the system ensures `admin@portfolio.dev` and `user@portfolio.dev` exist with permanent passwords and correct group membership (`admins` and `users` respectively)

## R8 — Architecture constraints

### R8.1 The backend SHALL follow hexagonal architecture

- **Given** the source tree under `backend/src/`
- **When** reviewing layer boundaries
- **Then** `domain/` depends on nothing external; `application/` depends only on `domain/`; `infrastructure/` implements `domain/ports/`; `interfaces/` calls `application/use-cases/`

### R8.2 The LLM provider SHALL be swappable via the `LLMPort` interface

- **Given** the `LLM_PROVIDER` env var set to `gemini` or `openai`
- **When** the LLM factory instantiates an adapter
- **Then** the appropriate adapter (`GeminiLLMAdapter` or `OpenAILLMAdapter`) is used without changes to use cases

### R8.3 The database adapter SHALL be swappable via the `DatabasePort` interface

- **Given** the `DatabasePort` interface with `insert<T>` and `select<T>` methods
- **When** the composition root instantiates `NeonDatabaseAdapter`
- **Then** any use case can be tested with a mocked `DatabasePort` and production runs against Neon

## R9 — Cost discipline

### R9.1 All AWS services SHALL operate within Free Tier limits

- **Given** the choice of services: Lambda, API Gateway HTTP, EventBridge, SQS, Cognito, CloudWatch, Secrets Manager, S3 (limited)
- **When** the stack deploys and runs under normal demo load
- **Then** monthly AWS cost is ≤$1 (ideally $0)

### R9.2 Prohibited services SHALL NOT appear in the stack

- **Given** the prohibited list: NAT Gateway, ALB, NLB, ECS, EKS, Fargate, RDS, Aurora, ElastiCache, EFS, FSx
- **When** the CDK stack is synthesized
- **Then** no prohibited service resource appears in the CloudFormation template

## R10 — Observability

### R10.1 All Lambda functions SHALL log structured JSON

- **Given** any Lambda function (HealthHandler, MigrationFunction, ApiHandler)
- **When** the function executes
- **Then** CloudWatch Logs contains JSON entries with fields: `level`, `message`, `requestId`, `eventType`, `timestamp`

### R10.2 Custom metrics SHALL use namespace `FinanceCoachLATAM`

- **Given** business metrics emitted by handlers
- **When** a metric is published
- **Then** it appears in CloudWatch Metrics under namespace `FinanceCoachLATAM`