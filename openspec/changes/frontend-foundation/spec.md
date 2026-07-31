# Frontend Foundation Specification

The SPA MUST consume the API without duplicating R1–R10 and MUST expose loading, empty, success, and failure states.

## Requirements

### Requirement: Auth and session
The SPA MUST authenticate email/password, retain the JWT, send `Authorization: Bearer <token>`, refresh before expiry, and support logout. Expiry or 401 MUST clear the session and redirect to login.

#### Scenario: expired session
- GIVEN an expired token or API 401
- WHEN a protected request occurs
- THEN the session is cleared and login renders.

### Requirement: Role-safe routing
Every page MUST verify `admin` or `user` before rendering or requesting data. A disallowed role MUST render or redirect to 403.

#### Scenario: user opens admin page
- GIVEN an authenticated `user`
- WHEN `/admin/categories` opens
- THEN 403 renders and admin data is not requested.

### Requirement: Categories CRUD UI
Admins MUST list, create, PATCH-edit, and delete categories using slug, name, and hex color. v1 MUST NOT expose `Category.icon`. Duplicate slugs MUST show the backend uniqueness error inline. Delete MUST optimistically remove and restore the row on 409 with a conflict message.

#### Scenario: category is in use
- GIVEN a referenced category
- WHEN delete returns 409
- THEN the row is restored and the conflict explains why.

### Requirement: Accounts CRUD UI
The SPA MUST list accounts filtered by `userId` and create accounts with a `BANK`, `CASH`, or `CARD` select. Backend `{message, details}` validation MUST appear verbatim beside the offending field.

#### Scenario: invalid account
- GIVEN the API rejects an account field
- WHEN creation is submitted
- THEN its exact validation message appears beside that field.

### Requirement: Transactions UI
The SPA MUST list transactions with pagination and `limit ≤ 100`; create with integer `amountCents` and an ISO `occurredAt` date picker; and provide categorization showing `PENDING`, `FAILED`, or `CATEGORIZED`.

#### Scenario: categorization result
- GIVEN a pending transaction
- WHEN categorization succeeds or fails
- THEN the displayed state becomes CATEGORIZED or FAILED and is actionable.

### Requirement: Admin views
Admins MUST have user list/create views and a clearly labeled global analytics placeholder. Non-admins MUST not receive admin data.

#### Scenario: create user
- GIVEN an authenticated admin with valid data
- WHEN create is submitted
- THEN the new user appears in the list.

### Requirement: Resilient list states
Every list view MUST provide loading, empty, and error states. Loading MUST end on success, empty response, or failure; retry MUST be available for retryable errors.

#### Scenario: empty list
- GIVEN a successful empty response
- WHEN the list renders
- THEN an actionable empty state appears, not an endless spinner.

### Requirement: Network and API errors
CORS, connectivity, and generic 5xx failures MUST show a retryable toast. Backend `{message, details}` MUST remain inline and field-specific; 401 follows session handling and 403 follows role handling.

#### Scenario: server failure
- GIVEN a 5xx response
- WHEN a request fails
- THEN a retryable toast appears and loading ends.

### Requirement: Atomic Design boundaries
Atoms MUST have no API calls or remote state. Molecules MUST have no API calls and only local state. Organisms MUST orchestrate remote data through hooks; templates receive content; pages own routing.

#### Scenario: boundary inspection
- GIVEN an atom or molecule
- WHEN dependencies are inspected
- THEN no API client or data-fetching hook is present.

### Requirement: Strict TDD evidence
Every atom, molecule, and organism MUST have a colocated `*.test.tsx`; every hook MUST have `*.test.ts`. Tests MUST precede implementation, and `cd frontend && npm test` MUST run independently.

#### Scenario: new organism
- GIVEN a new organism
- WHEN reviewed
- THEN its colocated test exists and runs in the frontend command.

### Requirement: Free deployment contract
Frontend deployment MUST target $0 Cloudflare Pages, use `cloudflare/wrangler-action@v4`, and path-filter both deploy workflows to `frontend/**`.

#### Scenario: backend-only commit
- GIVEN only backend files changed
- WHEN workflows evaluate paths
- THEN frontend deployment does not run.
