# Proposal: frontend-flow-completion

## Intent
The frontend foundation shipped auth, routing, the Litografía del Sur design system, and one Categories page, but only 1 of ~6 product pages. Dashboard is still a placeholder; users cannot log transactions or manage accounts in the UI, and no UI path exists to override LLM categorization. Complete the core product flow against the deployed AWS backend while preserving the $0-cost portfolio constraint.

## Scope

### In Scope
- **PR1 — backend:** add `PATCH /transactions/{id}` accepting `{ categoryId }`, restricted to the transaction owner or an admin; include tests and URL-helper tests.
- **PR2 — frontend:** fix URL construction (strip trailing base-URL slash and remove CORS double-slash behavior everywhere); build Transactions (list/create/categorize/override), Accounts (list/create), admin Users (list/create), and use all existing accounts/categories/users/transactions endpoints. Install Recharts, not yet used in UI.
- **PR3 — dashboard:** replace `ComingSoonPage` with monthly spend, top three categories, PENDING/FAILED count, last five transactions, Recharts donut (spend by category), and sparkline (monthly trend).
- Extend the shipped **Litografía del Sur** direction—dusty paper, cobalt masthead, named signal inks, ledger-like numerics—to every new page; do not default to the three AI-typical looks.

### Out of Scope
CSV import (no `/transactions/bulk` endpoint), global analytics, mobile hamburger navigation, and WebSocket real-time updates. No heavy analytics or ML features.

## Capabilities

### New Capabilities
- `frontend-flow-completion`: complete authenticated CRUD, categorization override, and dashboard presentation.

### Modified Capabilities
- `authorization`: owner-or-admin authorization for transaction category overrides.
- `transaction-categorization`: user-visible override after automatic categorization.
- `admin-categories`: frontend consumption of the existing category CRUD contract.

## Approach
Three chained PRs stacked to `main`, auto-executed, with strict TDD active. PR1 MUST merge before PR2; PR2 MUST merge before PR3. Apply the relaxed frontend-foundation TDD policy: presentational atoms may share tests, while organisms/hooks/state logic retain colocated tests. Use Recharts (Chart.js is the alternative, but Recharts is already approved and installed in the foundation direction). Bundle-split page/chart code at route boundaries where supported by the existing Vite/React Router setup.

## Affected Areas

| Area | Impact |
|---|---|
| `backend/src/interfaces/http/transactions.routes.ts`, application/use-cases | New PATCH contract and owner/admin guard |
| `backend` tests | New endpoint/use-case coverage |
| `frontend/src/services/apiClient.ts`, hooks, pages, charts | URL fix and product flows |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| PR2/PR3 exceed 400-line review budget | High | Size:exception likely; keep slices focused and follow foundation TDD relaxation |
| Litografía aesthetic stops at chrome | Medium | Review every page against shipped tokens, typography, ledger patterns, and signal inks |
| Gemini quota/failure or slow categorization | Medium | Surface PENDING/FAILED states; backend keyword → cache → embedding → LLM path remains authoritative |

## Dependencies
- PR1 backend MUST merge before PR2, because frontend override uses the new PATCH.
- PR2 MUST merge before PR3, because dashboard reads the completed transaction/account/category flows.
- Existing Cognito JWT auth, deployed AWS API, Neon, and Gemini remain unchanged; delivery target is $0 cost.

## Success Criteria
- [ ] User logs in, sees real stats/charts, navigates to Transactions, creates a transaction, observes categorization, and overrides its category.
- [ ] User manages accounts; admin manages users and categories through deployed AWS endpoints.
- [ ] URL and CORS double-slash bugs are absent; strict TDD suites pass; dashboard replaces ComingSoonPage.

## Rollback Plan
Revert PR3 to restore `ComingSoonPage`, PR2 to restore the prior frontend flow, and PR1 to remove the PATCH route. Cloudflare’s last successful frontend deployment remains serving while a revert is deployed; backend existing endpoints remain available.

## Open Assumptions
- Vitest + React Testing Library remain the frontend test stack; backend continues Vitest 2.x.
- Auth remains direct Cognito JWT (`Authorization: Bearer`), without Hosted UI.
- Recharts is the chart library; Chart.js is deferred unless bundle or accessibility evidence requires a change.
- Route-level lazy loading is the bundle-splitting strategy; no broad analytics dependency is introduced.
- Dashboard metrics are derived from the existing transaction list within the API’s supported result limits.
