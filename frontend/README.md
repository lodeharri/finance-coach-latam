# Litografía del Sur — Finance Coach LATAM

Personal-finance coach for LATAM users. React 18 + Vite + TypeScript strict + Tailwind, deployed on Cloudflare Pages (free tier), consuming the AWS-backed API over `Authorization: Bearer <IdToken>`.

## Stack

- **Build / runtime:** Vite 5, React 18, TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **Styling:** Tailwind 3 + CSS variables (`src/styles/tokens.css`)
- **Tests:** Vitest + React Testing Library + Playwright
- **Lint:** ESLint (react / react-hooks / jsx-a11y / @typescript-eslint) + Prettier + Husky pre-commit
- **Hosting:** Cloudflare Pages free tier via `cloudflare/wrangler-action@v4`

## Folder layout (Atomic Design)

Strict layering: atoms are presentational only, molecules compose atoms locally, organisms orchestrate remote data, templates receive content, pages own routing. See `openspec/changes/frontend-foundation/design.md` §2.3 for the rationale.

```
frontend/
├── src/
│   ├── app/                  # App.tsx, providers, router (later PRs)
│   ├── atoms/                # Button, Input, Label, Badge, Spinner, HexStamp
│   ├── molecules/            # FormField, AmountText, CategoryPill, Toast
│   ├── organisms/            # TransactionTable, CategoryTable, ImportWizard
│   ├── templates/            # AppShell, AuthShell (later PRs)
│   ├── pages/                # ComingSoonPage (this PR); LoginPage, etc. (later)
│   ├── hooks/                # useAuth, useTransactions (later PRs)
│   ├── services/             # apiClient, auth, types (later PRs)
│   ├── stores/               # session, ui (later PRs)
│   ├── styles/               # tokens.css, tailwind.css
│   └── test/                 # setup.ts, test-utils.tsx, msw handlers (skeleton)
├── e2e/                      # Playwright specs
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
npm run dev        # http://localhost:5173
npm test           # Vitest unit + RTL
npm run e2e        # Playwright (against VITE_BASE_URL)
npm run build      # production bundle (dist/)
```

## Required environment

Build-time (`VITE_*` are exposed to the client):

| Var | Source |
|---|---|
| `VITE_API_BASE_URL` | GitHub Actions: `needs.deploy.outputs.api_url` (staging) or repo variable (production) |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | GitHub secret |
| `VITE_COGNITO_REGION` | GitHub secret (`AWS_REGION`) |

See `RUNBOOK.md` for the deploy secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).

## Design system

See `openspec/changes/frontend-foundation/design.md` §1 for "Litografía del Sur" — a 1960s–70s Latin American editorial aesthetic. Cobalt brand on warm paper, tabular lining figures, ledger line numbers. The cobalt masthead is the signature element on every authenticated page (lands in a later PR).

## Status

- **PR1 (this slice):** scaffold + Tailwind tokens + Vitest/RTL/Playwright config + Cloudflare Pages deploy job + Coming-Soon page. No atoms yet.
- PR2: atoms + molecules with colocated tests.
- PR3: API client + auth + first organisms.
- PR4: pages + routing + role guards.
- PR5: Playwright e2e + runbook finalize + polish.
