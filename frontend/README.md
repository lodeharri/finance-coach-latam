# Litografía del Sur — Finance Coach LATAM (Frontend)

The frontend SPA for [Finance Coach LATAM](../README.md). React 18 + Vite + TypeScript strict + Tailwind 3 + Atomic Design, deployed on Cloudflare Pages (free tier), consuming the AWS-backed HTTP API v2 with direct `Authorization: Bearer <IdToken>` over the existing Cognito authorizer. Backend contract (categories, transactions, accounts, users, JWT shape) is unchanged — the SPA is a pure consumer of the `authorization`, `admin-categories`, and `transaction-categorization` specs.

## Stack

- **Build / runtime**: Vite 5, React 18, TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- **Styling**: Tailwind 3 + CSS variables (`frontend/src/styles/tokens.css`). Atomic Design layering.
- **Server state**: TanStack Query v5 (one `QueryClient`, retries, dedupe, optimistic mutations).
- **Client state**: Zustand slices (`sessionStore`, `toastStore`) with localStorage persist for the session.
- **Forms + validation**: react-hook-form + zod resolver. API request/response shapes use the same zod schemas as the wire (`frontend/src/services/types.ts`).
- **Auth**: direct `Authorization: Bearer <IdToken>` — no Hosted UI, no Amplify. `USER_PASSWORD_AUTH` via `InitiateAuth`; 60-second pre-expiry refresh; logout clears the store.
- **Tests**: Vitest + React Testing Library + Playwright. 24 colocated test files, 157 tests, 90.63 % lines coverage. Strict TDD policy applied — colocated `*.test.tsx` for atoms/molecules/organisms/hooks/stores/pages/templates; a shared `atoms.trivial.test.tsx` for pure presentational atoms with no logic.
- **Lint / format**: ESLint (react / react-hooks / jsx-a11y / @typescript-eslint) + Prettier + Husky pre-commit.
- **Hosting**: Cloudflare Pages free tier via `cloudflare/wrangler-action@v4` (NOT the deprecated `cloudflare/pages-action@v1`). 500 builds/month ceiling respected via `paths: frontend/**` filters on both deploy workflows.

## Design — "Litografía del Sur"

A single-direction modernist lithograph aesthetic pulled from 1960s–70s Latin American editorial design (Tropicália posters, Lina Bo Bardi's Instituto publications, Buenos Aires graphic design of the Rubén Fontana era). The brand color is a single saturated cobalt (`--ink-cobalto: #1F3FB8`) — used only on the 48 px cobalt masthead, the focus ring, and the HexStamp signature element. Every other surface is warm ochre paper (`--ink-paper: #F5F0E2`), every signal is a named ink color (`--ink-positivo` forest green, `--ink-negativo` rust, `--ink-fallo` wine, `--ink-alerta` ochre) — never the brand color. Amounts are set in tabular lining figures of a condensed grotesque display face (Bricolage Grotesque for titles, Public Sans for body, JetBrains Mono for numerics — all free/open), with line indices ("N.º 0042") that signal "ledger" rather than "card". Justification: cobalt on warm paper survives bright daylight on AMOLED/OLED; tabular lining figures are the actual readable unit for finance; line-numbering fits LATAM household bookkeeping; zero paid font/icon dependencies. Contrast on `--ink-paper` exceeds AAA for body text and AA for large text. See [`openspec/changes/archive/2026-07-31-frontend-foundation/design.md`](../openspec/changes/archive/2026-07-31-frontend-foundation/design.md) §1 for the full token system, the three rejected AI-default looks, and the rationale.

## Folder layout (Atomic Design)

Strict layering enforced: **atoms** are presentational only (no state, no API); **molecules** compose atoms locally (no API, only local state); **organisms** orchestrate remote data through hooks; **templates** receive content; **pages** own routing. This boundary is verified by grep — atoms/molecules have no imports from `apiClient`, `useQuery`, `services/`, or `hooks/`.

```
frontend/
├── src/
│   ├── app/                  # App.tsx, router.tsx, RequireAuth, RequireRole
│   ├── atoms/                # Button, Input, Label, Badge, Spinner, HexStamp
│   ├── molecules/            # FormField, AmountText, CategoryPill, Toast, RoleBadge
│   ├── organisms/            # CategoryTable, ToastHost
│   ├── templates/            # AppShell, AuthShell
│   ├── pages/                # LoginPage, ComingSoonPage, CategoriesAdminPage,
│   │                         # ForbiddenPage, NotFoundPage
│   ├── hooks/                # useAuth, useCategories, useToast
│   ├── services/             # apiClient, auth, types (zod schemas)
│   ├── stores/               # sessionStore, toastStore
│   ├── styles/               # tokens.css, tailwind.css
│   └── test/                 # setup.ts, test-utils.tsx, msw handlers
├── e2e/                      # Playwright specs (smoke, auth, admin-403)
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── postcss.config.js
├── .eslintrc.cjs
├── .prettierrc
├── RUNBOOK.md                # secrets, 500-builds/mo ceiling, CORS, action version
└── package.json
```

## Quickstart

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm test             # vitest run (157/157)
npm run typecheck    # tsc --noEmit (clean)
npm run lint         # eslint . (0 errors, 2 non-blocking warnings on router.tsx)
npm run build        # vite build → dist/ (~291 KB JS, ~13 KB CSS; gzip ~93/3.5)
npm run e2e          # playwright test (gated on VITE_BASE_URL)
```

## Required environment

Build-time (`VITE_*` are exposed to the client):

| Var | Source |
|---|---|
| `VITE_API_BASE_URL` | GitHub Actions: `needs.deploy.outputs.api_url` (staging) or repo variable (production) |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | GitHub secret |
| `VITE_COGNITO_REGION` | GitHub secret (`AWS_REGION`) |

Deploy-time secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) live in GitHub Actions and are documented in `RUNBOOK.md` along with the 500-builds/mo ceiling, the `wrangler-action@v4` action name (NOT `pages-action@v1`), and the rollback procedure.

## Status

Phase 6 (`frontend-foundation`) closed. 5 chained PRs (#30–#34) merged stacked-to-main; backend 142/142 tests + frontend 157/157 tests passing; 8/8 ADRs honored; $0 monthly cost confirmed. See [`openspec/changes/archive/2026-07-31-frontend-foundation/archive-report.md`](../openspec/changes/archive/2026-07-31-frontend-foundation/archive-report.md) for the full cycle summary, carry-forward follow-ups (AccountsPage, UsersAdminPage, ESLint react-refresh warnings, global coverage threshold, Playwright e2e wiring), and the `frontend/RUNBOOK.md` §13 open follow-ups list.