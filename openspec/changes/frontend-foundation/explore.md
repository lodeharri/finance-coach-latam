# Exploration — `frontend-foundation`

> Change: `frontend-foundation` — React 18 + Vite + TypeScript + Tailwind + Atomic Design SPA, deployed to Cloudflare Pages (free tier), integrated into the existing auto-deploy workflows.

## Current State

### `frontend/` directory (verified)

The directory exists as a **placeholder only**. Confirmed contents on 2026-07-31:

- `frontend/README.md` (47 lines) — describes the *planned* stack and Atomic Design scaffold but no code.
- `frontend/package.json` (6 lines) — name, version, private, description; **no `dependencies`, no `scripts`, no `type: "module"`, no `engines`**. Cannot run `npm install` or `npm run build` against it.
- No `tsconfig.json`, no `vite.config.*`, no `tailwind.config.*`, no `index.html`, no `src/`, no `.gitignore` (the root `.gitignore` does not exclude `frontend/dist/` or `frontend/node_modules/` today — that gap is below).
- No test runner, no linter, no formatter. **This is the largest gap to plan around.**

### Backend API surface the SPA must consume (verified)

The backend is hexagonal, ESM, Node 24, deployed via Lambda + API Gateway HTTP API v2 + Cognito JWT authorizer. Endpoints the SPA will hit:

| Method | Path | Auth | Purpose | Source |
|---|---|---|---|---|
| `GET`  | `/users` | Cognito + admin | List users (admin only) | `users.routes.ts:24-27` |
| `POST` | `/users` | Cognito + admin | Create user (admin only) | `users.routes.ts:29-46` |
| `GET`  | `/accounts?userId=` | Cognito | List accounts for a user (admin can target any) | `accounts.routes.ts:26-30` |
| `POST` | `/accounts` | Cognito | Create account (`type` ∈ `BANK` \| `CASH` \| `CARD`) | `accounts.routes.ts:32-46` |
| `GET`  | `/categories` | Cognito | List categories | `categories.routes.ts:32-34` |
| `POST` | `/categories` | Cognito + admin | Create category (slug, name, color, async embedding) | `categories.routes.ts:36-67` |
| `PATCH` | `/categories/{id}` | Cognito + admin | Update name and/or color; invalidates `merchant_category_cache` | `categories.routes.ts:69-109` |
| `DELETE` | `/categories/{id}` | Cognito + admin | 204 on success, 409 if in use | `categories.routes.ts:111-128` |
| `GET`  | `/transactions?userId=&limit=` | Cognito | List transactions (1 ≤ limit ≤ 100) | `transactions.routes.ts:47-60` |
| `POST` | `/transactions` | Cognito | Create transaction (integer `amountCents`, ISO `occurredAt`, `accountId`, `merchant`, optional `notes`) | `transactions.routes.ts:62-87` |
| `POST` | `/transactions/{id}/categorize` | Cognito | Trigger re-categorization (LLM-backed) | `transactions.routes.ts:32-41` |
| `GET`/`POST` | `/health` | None | Liveness only | `health.handler.ts` |

Domain entities (single source of truth in `backend/src/domain/entities/`):

- `User` — `id`, `email`, `name`, `tier` (`BRONZE`\|`SILVER`\|`GOLD`), `createdAt`. **Not** part of the SPA's current spec scope, but admin views need it.
- `Account` — `id`, `userId`, `name`, `type` (`BANK`\|`CASH`\|`CARD`), `createdAt`.
- `Category` — `id`, `slug` (unique), `name`, `color` (hex `#RRGGBB`). The entity does **not** include `icon`; the spec mentions `icon` in `REQ-AC-001` text but the route layer only validates `slug`/`name`/`color`. **The SPA must not render an `icon` field that the backend never persists.**
- `Transaction` — `id`, `userId`, `accountId`, `categoryId` (nullable), `merchant`, `amount` (note: backend entity uses `amount`, but the API contract uses `amountCents` — see Risks), `occurredAt`, `createdAt`, `status` (`PENDING`\|`CATEGORIZED`\|`FAILED`), `notes` (nullable).

### Cognito JWT authorizer (verified)

`infra/lib/finance-coach-stack.ts:52-68` configures:

- Two groups: `admins` and `users` (`CfnUserPoolGroup`, names are **plural**).
- `HttpJwtAuthorizer` validates the JWT before the route runs; `event.requestContext.authorizer.jwt.claims` is forwarded.
- The backend's `authenticate()` (`http.utils.ts:138-185`) normalizes `cognito:groups` from a string OR array (HTTP API v2 sometimes drops the colon-prefixed claim, so it falls back to decoding the raw `Authorization` Bearer JWT) and resolves `role` ∈ `'admin' | 'user'`. Anything else → 401.
- Verified token shape: `{ userId, email, role }`. `userId === sub`, `email` is the email claim, `role` comes from groups.

**Implication for the SPA:** the frontend never re-validates the JWT. It just reads the email/sub from the ID token and the group from `cognito:groups` to decide whether to render admin views. The API will 401/403 if the token is missing or stale — the SPA should map those to a logout/refresh flow, not a 500.

### Deploy workflows (verified)

`.github/workflows/deploy-staging.yml` (push to `main`, single job `deploy`):

1. `actions/checkout@v5`
2. `aws-actions/configure-aws-credentials@v6.2.3` with access-key-id/secret-access-key/region secrets
3. `actions/setup-node@v5` with Node 24 + npm cache keyed on `backend/package-lock.json`
4. `Build backend bundles` (`cd backend && npm ci && npm run build`) — `working-directory: backend` via the job-level `defaults`
5. `CDK deploy` (`cd infra && npm ci && npx cdk deploy FinanceCoachStack --require-approval never --outputs-file /tmp/cdk-outputs.json`)
6. Export `FinanceCoachApiUrl` from outputs
7. Smoke test (`/health` 200, `/categories` 401 without token)
8. Summary step

`.github/workflows/deploy-production.yml` is structurally identical but gated by:

- `on: workflow_dispatch` only (manual)
- A `guard` job that requires `inputs.confirm === "deploy to production"` (typo-protected)
- `environment: production` (GitHub required reviewers apply here)
- Production smoke test is a strict `set -e` version of the staging checks

**Both workflows assume `working-directory: backend` for every step via the job-level `defaults`.** A new `deploy-frontend` job will need its own `defaults.run.working-directory: frontend` (or explicit per-step working directories) — see Approaches.

There is no existing CI workflow that lints/builds/tests the frontend. `validate.yml` (1886 bytes) and `npm-audit.yml` (4933 bytes) were inspected briefly and appear backend-only. **The frontend is invisible to CI today.**

### Cloudflare GitHub Action — corrected finding (verified)

The user's hard constraint says "use Cloudflare's official GitHub Action". The README and existing memory may have pointed at `cloudflare/pages-action@v1`. **That action is DEPRECATED** — the upstream repo was archived 2024-10-21 and the maintainer banner reads "DEPRECATED, please use wrangler-action".

The current official action is **`cloudflare/wrangler-action@v4`** (uses Wrangler v4 by default; v3 still available via `wranglerVersion`). The relevant API:

- Inputs: `apiToken` (required), `accountId`, `workingDirectory`, `command`, `wranglerVersion`, `packageManager`, `gitHubToken`, `secrets`, `environment`, `preCommands`, `postCommands`.
- For Cloudflare Pages: the action runs `wrangler pages deploy <directory> --project-name=<name> --branch=<branch>`.
- Outputs: `command-output`, `command-stderr`, `deployment-url`, `pages-deployment-alias-url`.
- Permission required: `contents: read`, `deployments: write` (so commit statuses can be posted back to the PR).

`wrangler-action` does **not** require a `wrangler.toml` in the repo for Pages Direct Upload via GitHub Action (only when using local Wrangler). The required secrets are:

- `CLOUDFLARE_API_TOKEN` — Cloudflare account → My Profile → API Tokens → Custom token with `Account | Cloudflare Pages | Edit` permission (and a recommended `Account | Account Settings | Read` to discover projects). **This is a secret; never commit it.**
- `CLOUDFLARE_ACCOUNT_ID` — visible in the Cloudflare dashboard right-side API panel. Lower-sensitivity but still belongs in secrets.

### Cost / free-tier limits (verified)

Cloudflare Pages free tier (current published limits, accurate as of 2026-07-31):

- **Builds:** 500 builds/month. With the proposed `frontend/**` path filter on `deploy-staging.yml` + `deploy-production.yml`, the team will not exceed this.
- **Bandwidth:** unlimited. (Unusual; verified — Cloudflare does not meter egress on Pages free.)
- **Custom domains:** 100 per project. The team needs 1–2 (`staging.finance-coach-latam.pages.dev` is auto-issued; a future custom domain would be optional).
- **HTTPS:** included.
- **Files:** 25,000 files per deployment. A Vite SPA is hundreds of files, not thousands. Safe.
- **Max file size:** 25 MiB. SPA bundles are well under.
- **Concurrent builds:** 1. `concurrency: deploy-staging-${{ github.ref }}` (already present in the existing workflow) at the *job* level plus the same key on a new `deploy-frontend` job would serialize per-branch. The staging workflow already has `cancel-in-progress: false`, which is correct.

**The user's "$0 cost" hard constraint is satisfied** with the `frontend/**` path filter. We need to document the 500-builds/mo ceiling in the runbook the change produces so a future contributor doesn't burn it with reckless `push` triggers.

### Existing frontend README — what is locked

`frontend/README.md` already commits to:

- React 18 + TypeScript + Vite
- TailwindCSS for styling
- Recharts for data visualization
- PapaParse for CSV import (bank statements)
- Cloudflare Pages for hosting
- Atomic Design folder structure (atoms → molecules → organisms → templates → pages) with strict layer rules: atoms no state/API, molecules local state only, organisms orchestrate data fetching, templates receive content, pages are the only router-aware layer
- Custom hooks in `src/hooks/`, API client in `src/services/`, optional Zustand stores in `src/stores/`
- Roles: `user` (Dashboard, Transactions, Insights, Import) + `admin` (above + User Management, Global Analytics)

This is a **user-stated preference**, not a free variable. Approach A keeps it; Approach B partially re-shapes it.

### Past memory context (Engram)

Relevant existing observations: `#606` (SDD init 2026-07-31), `#643` (post-phase-6 roadmap), `#584` (Node 24 foundation), `#674` (vitest 2→4 backend), `#588` (session summary), `#589` (vitest setup for use cases). None of them cover the frontend — this change is greenfield for `frontend/`.

## Affected Areas

- `frontend/` — empty today; this change fills it.
- `.github/workflows/deploy-staging.yml` — add a `deploy-frontend` job (or convert the existing `deploy` job into a `deploy-backend` job + a new `deploy-frontend` job with a `frontend/**` path filter).
- `.github/workflows/deploy-production.yml` — same, with manual dispatch path.
- `frontend/.gitignore` (new) — at minimum `dist/`, `node_modules/`, `.env*.local`, `coverage/`, `playwright-report/`, `test-results/`.
- Root `.gitignore` — should also be updated to ignore `frontend/dist` and `frontend/node_modules` (defense in depth).
- `openspec/config.yaml` — `apply.test_command` currently hard-codes `cd backend && npx vitest run`. Will need to either (a) add a `cd frontend && npm test` companion or (b) keep the backend command and add a separate one for frontend. **sdd-apply should not silently break TDD** — surface this in the proposal.
- `openspec/changes/frontend-foundation/` — the new change folder, where this `explore.md` lives, plus `state.yaml`, `proposal.md`, `specs/frontend/**`, `design.md`, `tasks.md`, `verify-report.md`.
- `backend/src/lambdas/api/composition.ts` (composition root) — **not** affected; the SPA talks to the deployed API URL, not to backend internals. The CORS config on the API Gateway (`apigwv2.CorsHttpMethod.*` for GET/POST/PATCH/DELETE with `'*'` origins) already allows the SPA to call from any Pages subdomain.

## Approaches

### Approach A — Vite + React 18 + Tailwind + Atomic Design, screens in one slice

Exactly what `frontend/README.md` already proposes, plus Vitest + React Testing Library + Playwright, scaffolded in one PR with all the screens (Dashboard, Transactions, Insights, Admin) wired to the API.

- **Pros**
  - Matches the user's locked-in preference (README) verbatim. No justification overhead.
  - One PR = one mental model = easier to review if the line count is kept tight.
  - All 4 main screens share the same component primitives from the start → no churn in shared atoms/molecules.
  - Tightly aligned with the `frontend-design` skill principle: "structure is information" — atomic layers make the design tokens (atoms) a single source of truth.
- **Cons**
  - The change almost certainly blows the **400-line review budget** for a single PR. A realistic scaffold + 4 screens + auth flow + API client + test setup is ≥1,200 lines.
  - Hard to rollback a single screen if a regression slips through.
  - TDD-with-mocks pressure: it is hard to write meaningful component tests before the atoms are designed (the design phase decides button variants, input affordances, etc.).
  - Risk of a "scaffold dump" review where the reviewer skims screens because the diff is too large to read carefully.
- **Effort: High**

### Approach B — Vite + React 18 + Tailwind, Feature-Sliced Design instead of pure atomic

Keep the tech stack; replace the folder layout with `src/features/{auth,transactions,categories,insights,admin}/` each with its own `components/`, `hooks/`, `api/`, `types.ts`. Shared primitives go in `src/shared/ui/`.

- **Pros**
  - Each feature is self-contained → much cleaner PR slicing (one feature per chained PR).
  - Easier TDD: each feature's tests live next to the feature.
  - Reduces the "wrong layer" debate that Atomic Design tends to spark (is `CategoryPill` a molecule or an organism?).
  - Better fit for the future when `transactions` and `insights` diverge — feature slices prevent cross-feature coupling by construction.
- **Cons**
  - **Contradicts the locked-in `frontend/README.md`**. The user already chose Atomic Design. Re-litigating the folder layout is a meta-debate that the user told us not to enter.
  - Higher onboarding cost for someone reading the codebase for the first time — feature-sliced is less common than atomic in the React world.
  - Loses the "components themselves encode the visual hierarchy" signal that atomic design gives.
- **Effort: High** (re-planning cost cancels the gain)

### Approach C — Minimal scaffold first, screens in chained PR slices (RECOMMENDED)

The deploy workflow + the empty scaffold + the API client + the auth flow + the design system (`design.md` artifact) go in **PR #1**. Then 2–4 chained PRs deliver one feature each (Transactions, Categories admin, Insights, Auth polish), each on its own branch with autonomous scope, verification, and rollback. This matches the `ask-on-risk` PR strategy and the 400-line budget.

- **Pros**
  - **Respects the 400-line review budget** for PR #1. A scaffold + CI + deploy job + design tokens + auth shell fits in 350–400 lines.
  - **Sets up the deploy pipeline first**, so the team gets fast feedback on whether Cloudflare Pages actually accepts the Vite output before any UI work.
  - Each subsequent PR is small enough to review deeply (200–300 lines typical).
  - Matches the `sdd-phase-common.md` Section E guidance: "chained or stacked PRs using deliverable work units".
  - The chained structure gives `sdd-apply` natural checkpoints for `sdd-verify` to run the RED-GREEN-REFACTOR discipline per feature.
  - Easy rollback: if PR #3 (Categories admin) is broken, PRs #1 and #2 keep the deploy pipeline and Transactions UI working.
- **Cons**
  - The user must approve the chained-PR strategy up front (which the orchestrator should ask — see `ask-on-risk`).
  - Total wall-clock time is longer than Approach A (4 PRs vs 1).
  - Slight risk of a temporary "almost empty" deployed site between PRs #1 and #2. Mitigation: ship PR #1 with a "coming soon" page that proves the deploy pipeline end-to-end.
  - The user said the frontend-design skill must produce one real aesthetic risk — that risk lives mostly in the design system (PR #1), not in the feature PRs. Make sure the design system PR is the one that takes the risk, not the first trivial feature.
- **Effort: Medium**

### Recommendation: Approach C

It is the only approach that simultaneously (a) honors the 400-line review budget, (b) lets the deploy pipeline land first and prove itself, (c) keeps each PR reviewable, and (d) leaves room for the `frontend-design` skill to take one real aesthetic risk inside the design system PR. The locked-in stack (Approach A's tech) and the Atomic Design folder layout (from the README) are both preserved — only the **PR slicing** is different.

`frontend/README.md` should be updated as part of this change to reflect the new folder layout once `sdd-design` finalizes it, but the Atomic Design principles (atoms = no API, etc.) remain.

## Risks

1. **`cloudflare/pages-action` is deprecated.** If the user/team copies the old action name from memory or generic tutorials, the deploy will work today but will lose support and may break. `sdd-design` and the cycle's runbook must say **`cloudflare/wrangler-action@v4`** explicitly. (Mitigation: name the action in the task titles and the runbook.)
2. **The 500-builds/month Cloudflare Pages ceiling.** With a clean `frontend/**` path filter on both staging and production workflows, the team will not hit this. But future contributors could add unrelated paths to the filter or remove the filter entirely. The runbook must call this out.
3. **CORS is `Access-Control-Allow-Origin: *` on the API.** That is fine for a public demo, but it does mean any site on the internet can call the API with a valid token. The cost is bounded by Cognito's free tier (50K MAU) and the API Gateway throttle (100 RPS). Acceptable for the portfolio demo; document in the security section.
4. **The Category entity in `domain/entities/category.entity.ts` does not include an `icon` field**, but the spec text references `icon` in `REQ-AC-001`. The route layer only persists `slug`/`name`/`color`. If the design system renders an `icon` field, the SPA must round-trip it through local state only and never POST it. **Surface this to `sdd-design` so it does not waste effort on an `icon` that the backend will silently drop.**
5. **`amount` vs `amountCents` mismatch.** The API request body takes `amountCents` (integer), the persisted entity field is `amount`. The response from the backend will reflect the entity shape (likely `amount` — confirm with `getTransaction` / `listTransactionsByUser` use case). The SPA type generator should normalize this to a single `amountCents: number` field on the client. **Flag for `sdd-design` / `sdd-spec`.**
6. **No frontend test runner exists today.** Vitest 2/4 in the backend is in `package.json` there; the frontend has nothing. Vitest + React Testing Library + Playwright are the right picks (zero config, same runner family as backend → consistent `npm test` UX), but installing them is part of the change. **Surface as a dependency gap in the proposal.**
7. **`tsconfig.json` and `vite.config.ts` do not exist.** Must be created from scratch. Use the canonical Vite + React 18 + TS template (`create-vite`) as a starting reference, but trim it to the README's planned layout.
8. **Cognito authorizer's colon-prefixed `cognito:groups` claim is unreliable in HTTP API v2.** The backend has a fallback path that decodes the raw Bearer token to recover the claim. The SPA should never depend on `event.requestContext.authorizer.jwt.claims` directly — it should only send the raw `Authorization: Bearer <token>` header to the API and let the backend normalize. This is a "do not regress" guard.
9. **The 400-line review budget is per PR, not per change.** A naive `sdd-apply` run that drops the entire `frontend/` directory in one PR will fail the budget gate. `sdd-tasks` must explicitly call out `Decision needed before apply: Yes`, `Chained PRs recommended: Yes`, `400-line budget risk: High (if not sliced) / Low (if sliced)`.
10. **TDD is active per `openspec/config.yaml`.** Component tests come first. The Vitest setup is part of PR #1 (before any atoms are written). The proposal should commit to RED-GREEN-REFACTOR for atoms (Button, Input, Label, Badge) and molecules (FormField, StatCard) — organisms and pages can be tested with React Testing Library + MSW mocks of the API.
11. **The `frontend-design` skill explicitly warns against the three AI-default looks** (warm cream + terracotta serif; near-black + acid-green/vermilion; broadsheet hairline rules). `sdd-design` must pick a *fourth* look with a justified aesthetic risk. The exploration phase is the right place to flag this so the design phase does not default. **No design direction is decided here** — that is the design phase's job.
12. **Cost: $0 is non-negotiable.** Cloudflare Pages free tier covers the deploy target. No other paid services should be introduced. If the design phase proposes a paid font, a paid icon set, or a paid analytics service, it must be rejected at the proposal step.

## Ready for Proposal: Yes

What the orchestrator should tell the user before launching `sdd-propose`:

1. **Cloudflare Pages action name is `cloudflare/wrangler-action@v4`** — not the older `cloudflare/pages-action@v1` (deprecated 2024-10-21). The proposal and runbook must say so explicitly.
2. **Approach C (chained PRs) is recommended** over Approach A (one big PR) because of the 400-line review budget. The user said `ask-on-risk`, so this is the right place to ask: "Confirm chained PRs (4 slices) or insist on a single PR with the budget overridden?" (Exception: the chain must include a 'trivial initial slice that ships a deploy pipeline + empty design system + auth shell', so even the first PR is useful on its own.)
3. **Vitest + React Testing Library + Playwright are the proposed test stack** — to be added in the first PR. The proposal should commit to TDD with these tools.
4. **The `frontend-design` skill is mandatory for the design phase** — and the proposal must commit to one aesthetic risk that is *not* one of the three AI defaults. The exploration phase is the right place to acknowledge this and defer the actual choice.
5. **There is a real gap in `openspec/config.yaml`**: `apply.test_command` is `cd backend && npx vitest run`. The proposal should propose either (a) adding `cd frontend && npm test` as a second command, or (b) splitting into `apply.test_command.backend` and `apply.test_command.frontend`. Either way, the backend's hard command must not be silently removed.
6. **The `Category` entity does not include `icon`** even though the spec text mentions it. The proposal should NOT plan an `icon` field on the SPA that the backend silently drops. The design phase should treat `icon` as out-of-scope for v1, or push a backend delta first.
7. **Secrets required for the deploy job** (documented in the runbook, never committed): `CLOUDFLARE_API_TOKEN` (Pages:Edit), `CLOUDFLARE_ACCOUNT_ID`. Plus the existing `AWS_*` secrets for the backend job. The runbook must list them and link the Cloudflare doc for token creation.

Once the user confirms approach C and the test stack, `sdd-propose` can write `proposal.md` and move forward.
