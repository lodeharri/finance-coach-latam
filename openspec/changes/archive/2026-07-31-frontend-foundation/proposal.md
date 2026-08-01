# Proposal: frontend-foundation

## Intent

`frontend/` is a placeholder today. This change ships the React 18 + Vite + Tailwind SPA, the design system, and the Cloudflare Pages auto-deploy so users and admins can manage categories, transactions, and accounts from a browser. Backend specs (`authorization`, `admin-categories`, `transaction-categorization`) are NOT modified; the SPA is a consumer.

## Scope

**In Scope.** Real `frontend/` (React 18, Vite, TS, Tailwind, Recharts, PapaParse, MSW); test stack (Vitest + React Testing Library + Playwright); Atomic Design per `frontend/README.md` (atoms no state/API; molecules local state; organisms orchestrate; templates receive content; pages are router-aware); design system with **one deliberate non-default aesthetic risk** (NOT cream/terracotta, NOT black/acid-green, NOT broadsheet hairline rules — design phase picks the fourth); auth shell (Cognito ID token → `Authorization: Bearer`; role from `cognito:groups`; 401 → logout); typed API client (normalizes `amount`↔`amountCents`); new `deploy-frontend` job using **`cloudflare/wrangler-action@v4`** (NOT the deprecated `pages-action@v1`) path-filtered to `frontend/**`; runbook (secrets, 500 builds/mo ceiling, CORS posture).

**Out of Scope (Non-Goals).** PWA / service worker, native mobile, Hosted UI / OAuth beyond the JWT, backend changes (no `icon` field on Category), analytics, paid fonts/icons.

## Success Metrics

- [ ] Cloudflare Pages deploys on every `main` push touching `frontend/**`, <2 min.
- [ ] SPA renders at `*.pages.dev`, calls API with Bearer, shows Dashboard/Transactions/Categories.
- [ ] Vitest + RTL ≥50% lines on atoms/molecules + key organisms.
- [ ] Playwright e2e covers auth shell + one happy-path CRUD.
- [ ] `$0` monthly cost confirmed; build count <500/mo.
- [ ] Playwright smoke per deploy job passes.

## Approach

**Approach C — chained PRs** (4–5 slices). Realistic footprint is ≥1,200 lines vs the 400-line review budget; one PR fails the gate. `sdd-tasks` forecasts each slice; orchestrator runs `ask-on-risk` if any slice is high.

| # | Scope |
|---|---|
| PR #1 | Scaffold + Vite + Tailwind + Vitest/RTL + Playwright + deploy job + design system + auth shell + "coming soon" page |
| PR #2 | Transactions view + `useTransactions` hook + tests |
| PR #3 | Admin Categories CRUD + `useCategories` + tests |
| PR #4 | Insights (Recharts) + Dashboard wiring + admin user list |
| PR #5 | Polish: error toasts, 401 logout, Playwright happy paths |

## Capabilities

- **New:** `frontend-spa` (UI shell, design tokens, deploy pipeline, auth flow) → `openspec/specs/frontend-spa/spec.md`.
- **Modified:** None.

## Affected Areas

| Area | Impact |
|---|---|
| `frontend/` | New (full scaffold + design system + tests) |
| `.github/workflows/deploy-staging.yml` | New `deploy-frontend` job, `frontend/**` filter |
| `.github/workflows/deploy-production.yml` | Same, gated by manual dispatch + guard |
| `frontend/.gitignore` | New |
| `.gitignore` (root) | Add `frontend/dist`, `frontend/node_modules` |
| `openspec/config.yaml` | Add `apply.test_command.frontend`; keep backend command |
| `openspec/changes/frontend-foundation/` | New (this proposal + downstream artifacts) |

## Risks

| Risk | Mitigation |
|---|---|
| `cloudflare/pages-action@v1` resurrected from memory | Name `cloudflare/wrangler-action@v4` in task titles + runbook |
| 500 builds/mo ceiling breached | `frontend/**` path filter on both jobs; runbook documents the ceiling |
| CORS `*` lets any origin call API with valid token | Document; bounded by Cognito 50K MAU + API GW 100 RPS throttle |
| `Category.icon` in spec text but not persisted by backend | Design phase treats as out-of-scope for v1; no icon field in SPA |
| `amount` vs `amountCents` mismatch (entity vs API) | API client normalizes to `amountCents: number`; type generator owns this |
| `openspec/config.yaml` test_command is backend-only today | Add `apply.test_command.frontend`; never remove backend |
| TDD pressure on atoms before design decisions | PR #1 ships Vitest + RTL config FIRST; design system tasks include RED-GREEN-REFACTOR |
| Three AI-default looks (skill warns) | `frontend-design` skill mandatory; design phase takes a *fourth* justified risk |
| `$0` cost broken by paid font/icon/analytics | Reject paid deps in design phase; runbook gates it |
| Chained PR drift (one slice blows budget) | `sdd-tasks` forecasts per slice; `ask-on-risk` if high |

## Rollback Plan

- **Frontend deploy:** Cloudflare retains every deployment → `wrangler pages deployments rollback <id>` or revert PR.
- **Workflow:** Reverting the PR that added `deploy-frontend` removes auto-deploy; backend deploy unaffected (separate job).
- **Cloudflare rejection:** Job fails before deploy step; last successful deploy keeps serving.
- **Code:** `git revert <merge-sha>` → next push redeploys previous build.

## Dependencies

- Cloudflare account + Pages project (provisioned by team).
- GitHub secrets: `CLOUDFLARE_API_TOKEN` (Pages:Edit), `CLOUDFLARE_ACCOUNT_ID`.
- Existing `AWS_*` secrets continue to gate the backend job in the same workflow.

## Open Assumptions

| Assumption | Rationale |
|---|---|
| **Chained PRs (Approach C), not single PR** | `ask-on-risk` per session preflight; `sdd-tasks` forecasts each slice |
| **Vitest + RTL + Playwright** as the test stack | Satisfies strict TDD without new tooling decisions; same Vitest family as the backend |
| **Direct JWT in `Authorization: Bearer <token>`** (no Hosted UI) | Matches the existing Cognito authorizer; the backend already decodes the raw Bearer when HTTP API v2 drops `cognito:groups` |
| **Category `icon` field is OUT OF SCOPE for v1** | The backend entity and routes do not persist it; the spec text is wrong and would silently drop the field |
| **Frontend test command is `cd frontend && npm test`** (separate from the backend command) | Strict TDD applies to both layers; the backend command in `openspec/config.yaml` is not removed |
