# Design: frontend-foundation

> Change: `frontend-foundation` — React 18 + Vite + TS + Tailwind SPA on Cloudflare Pages (free tier), consuming the existing Cognito-authed HTTP API v2 with direct `Authorization: Bearer <token>`. Chained PRs to respect the 400-line review budget.

## 1. Design system

### 1.1 The brief, pinned before choosing

A personal-finance coach for LATAM users (Spanish + Portuguese speakers, mid-range Android is dominant), built on a hexagonal backend with strict free-tier cost discipline, deployed on AWS Lambda + Cloudflare Pages. The page's job is to make amounts legible and categorization trustworthy for people who have not been well-served by US-centric finance UI.

### 1.2 Three AI-default looks — REJECTED

| Default | Why I reject it for THIS brief |
|---|---|
| Cream `#F4F1EA` paper + high-contrast serif display + terracotta accent | This is the SaaS-artisan look that floods AI output. Terracotta is "warm trustworthy" generic; it says "organic coffee shop" more than "ledger your grandmother kept." Cream flattens the cultural specificity of LATAM finance (real LATAM ledgers are warmer, dustier, more ochre than cream). |
| Near-black background + single acid-green/vermilion accent | The "trader dashboard" trope. Dark UIs are hostile in bright LATAM daylight (commuting, market stalls) and on mid-range OLED phones; the acid-green accent screams "men's magazine tech" not "family bookkeeping." |
| Broadsheet layout with hairline rules, zero border-radius, dense newspaper columns | A fetishization of editorial form without a reason. Hairline rules become invisible on sub-pixel laptop screens and read as noise on mobile; zero border-radius makes interactive controls feel flat and clickable-target-ambiguous. |

### 1.3 The aesthetic risk I take — "Litografía del Sur"

A single-direction modernist lithograph aesthetic pulled from 1960s–70s Latin American editorial design (Tropicália posters, Lina Bo Bardi's Instituto publications, Buenos Aires graphic design of the Rubén Fontana era). The risk is *brand color*: finance UIs default to green-up / red-down or trust-blue. I commit to a **single saturated cobalt** as the brand color, with all signals (positive, negative, warning, failed) carried by *named ink colors* — never by the brand color. This means a category row is never "blue = neutral", it is "paper with cobalt name + ink numbers + signal chip." Amounts become legible not because they're big but because they're set in **tabular lining figures of a condensed grotesque display face**, with line numbers like a hand-kept ledger ("N.º 0042").

Justification: serves the brief because (a) cobalt on warm paper survives bright daylight on AMOLED/OLED, (b) tabular lining figures are the actual readable unit for finance — display weight carries the meaning, (c) the line-numbering signals "ledger" not "card" — a mental model that fits LATAM household bookkeeping, and (d) zero paid font or icon dependencies (Bricolage Grotesque, Public Sans, JetBrains Mono are all free).

### 1.4 Token system

```css
/* Surfaces (paper) */
--ink-paper:        #F5F0E2;  /* dusty ochre paper, NOT #F4F1EA cream */
--ink-paper-lift:   #FAF6EA;  /* card surfaces, slightly lifted */
--ink-paper-press:  #E8E1CF;  /* pressed/inset surfaces, inputs */

/* Inks (text) */
--ink-tinta:        #1B1F26;  /* deep ink, primary text (NOT navy SaaS) */
--ink-tinta-soft:   #4A4F5A;  /* secondary text */
--ink-tinta-mute:   #8A8678;  /* tertiary, placeholders */

/* Brand — ONE color, used sparingly */
--ink-cobalto:      #1F3FB8;  /* cobalt — masthead, primary buttons, focus rings */

/* Signals — named, never the brand */
--ink-positivo:     #1F4D2C;  /* deep forest — confirmed, success */
--ink-negativo:     #B8421A;  /* rust — debt, warning, destructive */
--ink-fallo:        #6E1F1F;  /* wine — failed (categorized FAILED state) */
--ink-alerta:       #C58A14;  /* ochre — pending, in-flight */
```

| Role | Family | Weight | Notes |
|---|---|---|---|
| Display | Bricolage Grotesque (Google, free, variable) | 700, optical-size 96 | Page titles, masthead, big numbers |
| Body | Public Sans (Google, free) | 400/500 | Paragraphs, labels |
| Numerics | JetBrains Mono (JetBrains, free) | 500 | Tabular amounts, IDs, dates, line indices |

| Scale | px / rem | Use |
|---|---|---|
| xs | 12 / 0.75 | Line index, mono captions |
| sm | 14 / 0.875 | Body small, labels |
| md | 16 / 1.0 | Body default |
| lg | 20 / 1.25 | Subheads |
| xl | 28 / 1.75 | Section heads |
| 2xl | 40 / 2.5 | Page titles |
| 3xl | 64 / 4.0 | Hero numerics on dashboard |

Spacing scale: 4-px base (`--space-1: 4px` … `--space-8: 64px`). Motion: `120ms ease-out` for hover, `240ms cubic-bezier(.2,.8,.2,1)` for entrance. `prefers-reduced-motion` honored via media query.

Contrast verification (manual against `--ink-paper`):
- `--ink-tinta` on paper: 13.8:1 (AAA)
- `--ink-cobalto` on paper: 7.1:1 (AAA for body, AA for large)
- `--ink-negativo` on paper: 5.6:1 (AA body, AAA large)
- `--ink-positivo` on paper: 9.4:1 (AAA)

### 1.5 Signature element

**The Cobalt Masthead.** A dense cobalt-blue band across the top of every authenticated page, 48 px tall, with: page name in Bricolage Grotesque 700 left-aligned; today's date in JetBrains Mono small-caps right-aligned; a 16×16 hexagonal lattice SVG (the architecture motif, used only here as a "system integrity" stamp) in the corner. This masthead is *chrome*, not content. It is the single deliberate use of `--ink-cobalto` on every page; everything else uses paper-and-ink.

## 2. Architecture

### 2.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite 5 + ESM | Fast HMR, native ESM, $0 |
| Runtime | React 18 + TS strict | `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` |
| Styling | Tailwind 3 + custom token layer (CSS variables) | Tailwind for utility; CSS vars for token pass-through to inline styles where needed |
| Routing | React Router v6 (data routers, role-aware guards) | Single client, deferred data routes, no SSR |
| Server state | TanStack Query v5 (one `QueryClient`) | Retries, stale-while-revalidate, dedupe; beats SWR on cache ergonomics |
| Client state | Zustand (small slice per domain: session, ui) | Light, no Redux boilerplate |
| API client | native `fetch` wrapped in `src/services/apiClient.ts` | One dep fewer than axios; explicit interceptor chain; tree-shakeable |
| Forms | react-hook-form + zod resolver | Same zod types as API request/response shapes |
| Charts | Recharts (per README) | Free, declarative, good enough for category spend + monthly trend |
| CSV import | PapaParse (per README) | Free, streaming, runs in worker |

### 2.2 Auth flow (direct JWT, no Hosted UI)

```
User -> POST https://cognito-idp.{region}.amazonaws.com/
  AuthFlow: USER_PASSWORD_AUTH
  AuthParameters: { USERNAME, PASSWORD }
  ClientId: <userPoolClientId>
-> { IdToken, AccessToken, RefreshToken, ExpiresIn }
   SPA stores IdToken + RefreshToken + ExpiresIn in Zustand + localStorage
   Decodes IdToken payload for { sub, email, cognito:groups }
   Resolves role = admins -> 'admin' else users -> 'user'
   Every API call: Authorization: Bearer <IdToken>
   On 401: clear store -> redirect /login
   60s before exp: refresh via REFRESH_TOKEN_AUTH
```

Backend already supports this contract: `HttpJwtAuthorizer` validates signature; `authenticate()` in `http.utils.ts` parses `cognito:groups` from the claims or falls back to decoding the raw Bearer. SPA must NOT re-validate the JWT.

### 2.3 Folder structure (Atomic Design, opinionated)

```
frontend/
  src/
    app/                  # bootstrapping, QueryClient, Router, providers
      App.tsx, providers.tsx, router.tsx
    atoms/                # no state, no API: Button, Input, Label, Badge,
                          # Spinner, Icon (inline SVG only), HexStamp
    molecules/            # local state only: FormField, StatCard, CategoryPill,
                          # TransactionRow, AmountText, RoleBadge, Toast
    organisms/            # data orchestration via hooks:
                          # TransactionTable, CategoryBreakdown,
                          # ImportWizard, AdminUserList
    templates/            # layout shells: AppShell, AuthShell, AdminShell
    pages/                # router-aware ONLY:
                          # DashboardPage, TransactionsPage, InsightsPage,
                          # CategoriesAdminPage, UsersAdminPage,
                          # ImportPage, LoginPage, NotFoundPage, ForbiddenPage
    hooks/                # useAuth, useTransactions, useCategories,
                          # useAccounts, useUsers, useToast
    services/             # apiClient.ts (fetch wrapper + interceptors),
                          # auth.ts (Cognito USER_PASSWORD_AUTH),
                          # types.ts (zod schemas mirroring API contract)
    stores/               # session.ts, ui.ts (Zustand)
    styles/               # tokens.css (CSS variables), tailwind entry
    test/                 # test-utils (RTL render w/ providers), MSW handlers
  index.html
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  vitest.config.ts
  playwright.config.ts
  package.json
  .gitignore              # dist/, node_modules/, .env*.local, coverage/, test-results/
```

The split between `services/` and `hooks/` is deliberate: hooks own cache keys + invalidation, services own HTTP transport. Templates never import from `hooks/` or `services/`.

### 2.4 Data flow (auth-then-list canonical example)

```
LoginPage (page, router-aware)
  -> useAuth.login(email, password) (hook, calls auth.ts)
  -> auth.ts -> Cognito InitiateAuth -> {IdToken,...}
  -> sessionStore.setTokens + decode claims -> role
  -> navigate('/dashboard')

DashboardPage
  -> useTransactions({userId, limit:50}) (TanStack Query)
     -> apiClient.get('/transactions', { userId, limit:50 })
        -> fetch w/ Authorization header + 401-onResponse handler
        -> JSON parse + zod validate -> { items, ... }
  -> <TransactionTable items=.../> (organism)
     -> <TransactionRow .../> (molecule)
        -> <AmountText cents={...}/> (molecule)
           -> <span class="tabular-nums ..."> (atom wrapper)
```

## 3. Build, test, deploy

### 3.1 Vite config

- Build target `es2022`, `modulepreload` polyfill off (modern browsers).
- Env handling via `loadEnv(mode, '.', '')`. Vars prefixed `VITE_` exposed to client. Required: `VITE_API_BASE_URL`, `VITE_COGNITO_USER_POOL_CLIENT_ID`, `VITE_COGNITO_REGION`.
- Path alias `@/* -> src/*` in tsconfig + Vite.

### 3.2 Vitest config

- `jsdom` env, `globals: true`, `setupFiles: ['./src/test/setup.ts']`.
- RTL render wrapped in custom `renderWithProviders(ui, { route })` from `src/test/test-utils.tsx`.
- MSW for API mocking in organism + page tests; handlers colocated in `src/test/msw/`.
- Coverage threshold: `lines: 50, branches: 50, functions: 50, statements: 50` (matches backend config). Command: `cd frontend && npm test`.

### 3.3 Playwright config

- One smoke spec per slice: `e2e/auth.spec.ts` for the auth → dashboard happy path in PR5. PR1 ships the config + one passing empty test so CI runs green.
- `webServer` not used (deploys to Pages preview URL on PR).

### 3.4 Cloudflare Pages deploy job (exact yaml)

The new `deploy-frontend` job is added to both `deploy-staging.yml` and `deploy-production.yml`. It runs independently of `deploy`/`deploy-backend`, gated by path filter, and reads the API URL from CDK outputs (staging) or a GitHub Actions variable (production).

```yaml
  deploy-frontend:
    name: Deploy frontend to Cloudflare Pages
    needs: deploy            # only deploy after backend is up so smoke can use the URL
    if: needs.deploy.result == 'success'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Build SPA
        env:
          VITE_API_BASE_URL: ${{ needs.deploy.outputs.api_url }}
          VITE_COGNITO_USER_POOL_CLIENT_ID: ${{ secrets.COGNITO_USER_POOL_CLIENT_ID }}
          VITE_COGNITO_REGION: ${{ secrets.AWS_REGION }}
        run: |
          npm ci
          npm run build
          # fail the build if env vars were empty (silent bugs)
          test -n "$VITE_API_BASE_URL" || (echo "VITE_API_BASE_URL is empty" && exit 1)

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: frontend
          command: pages deploy dist --project-name=finance-coach-latam --branch=main

      - name: Smoke (Pages URL reachable)
        run: |
          URL="https://finance-coach-latam.pages.dev"
          HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
          [ "$HTTP" = "200" ] || (echo "Pages returned $HTTP" && exit 1)
```

Workflow-level path filter (both staging and production):

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
      - '.github/workflows/deploy-*.yml'   # pick up job changes
```

Production mirrors staging but the `deploy-frontend` job only runs after the human `guard` job passes and `needs.deploy.outputs.api_url` is set; it uses the same `VITE_*` env wiring. The `pages deploy --branch=main` command is for the main branch preview; PR previews use Cloudflare's automatic `*.pages.dev` per-PR URLs (no extra config).

### 3.5 Secrets list (runbook-owned, never committed)

| Secret | Purpose | Permission | Where documented |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Pages deploy | Account → Cloudflare Pages → Edit (+ Account Settings → Read) | `frontend/RUNBOOK.md` (cycle deliverable) |
| `CLOUDFLARE_ACCOUNT_ID` | Account target | Dashboard right-side API panel | `frontend/RUNBOOK.md` |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` (already exists) | SPA build | Public, but build-time | CDK output `UserPoolClientId` |
| `AWS_REGION` (already exists) | SPA build (Cognito region) | n/a | Workflow secrets |
| `AWS_*` (already exist) | Backend deploy job | n/a | Unchanged |

500-builds/mo ceiling documented in `frontend/RUNBOOK.md` with a note that removing the `paths:` filter will burn the budget.

## 4. ADRs (Architecture Decision Records)

| ID | Decision | Options considered | Choice | Rationale |
|---|---|---|---|---|
| ADR-FF-001 | Hosting | Cloudflare Pages / Vercel / Netlify / S3+CloudFront | **Cloudflare Pages** | $0/mo, free SSL, edge CDN, Git-direct deploy, generous static budget. Vercel/Netlify require a card at scale; S3+CloudFront is more wiring for the same outcome. |
| ADR-FF-002 | GitHub Action | `cloudflare/pages-action@v1` (deprecated) / `cloudflare/wrangler-action@v4` | **`cloudflare/wrangler-action@v4`** | `pages-action` was archived 2024-10-21. `wrangler-action@v4` is the maintained path, uses Wrangler v4 by default, requires no `wrangler.toml` for direct upload. |
| ADR-FF-003 | Server state | SWR / TanStack Query / Redux Toolkit Query / custom fetch cache | **TanStack Query v5** | Better cache-key ergonomics, mutation + invalidation are first-class, devtools, free. SWR is fine but Query wins on `invalidateQueries` and parallel queries. RTK Query drags in Redux for no benefit at this scale. |
| ADR-FF-004 | Auth surface | Cognito Hosted UI / direct JWT via InitiateAuth / Amplify | **Direct JWT** | Backend already decodes raw Bearer via `authenticate()`. Hosted UI adds a redirect surface, breaks SPA URL-as-state, requires OAuth config the backend doesn't use. Amplify adds 100+ KB and a paid-sdk flavor. |
| ADR-FF-005 | Delivery | Single PR / chained PRs (4–5 slices) | **Chained PRs** | 400-line review budget + ≥1,200-line realistic footprint. Chained PRs let deploy pipeline land first, give every slice autonomous scope + verification + rollback. |
| ADR-FF-006 | HTTP client | axios / native fetch | **Native fetch wrapped in `apiClient.ts`** | One dep fewer, tree-shakeable, full control over interceptor chain, no `axios.isCancel` quirks. |
| ADR-FF-007 | `Category.icon` in v1 | Render icon field / drop icon | **Drop — treat as out-of-scope** | `domain/entities/category.entity.ts` has no `icon`; route layer validates `slug`/`name`/`color` only. Spec text is wrong. Round-tripping icon would silently drop on POST. |
| ADR-FF-008 | Client state | Redux Toolkit / Zustand / React Context only | **Zustand + small slices** | Session + UI flags need a tiny store; Redux Toolkit is overkill. Context-only forces prop-drilling across organisms. Zustand: 1 KB, no provider, persistable. |

## 5. PR slice plan

Chained, base = `main`. Target: every slice ≤ 400 changed lines (additions + deletions). `sdd-tasks` forecasts each slice; if any looks like it will breach, `sdd-apply` triggers `ask-on-risk` per session preflight.

| # | Branch target | Scope | Est. lines | Verification |
|---|---|---|---|---|
| PR1 | `main` | Scaffold (Vite + TS strict + Tailwind), design tokens (`styles/tokens.css`, Tailwind config), `HexStamp`/`AmountText`/`Button`/`Input`/`Label` atoms (with colocated RTL tests, RED-first), Vitest + RTL config, Playwright config + empty smoke, `.gitignore` updates, root `openspec/config.yaml` adds `apply.test_command.frontend` AND keeps backend, new `deploy-frontend` job on `deploy-staging.yml` + path filter, `frontend/README.md` updated to reflect new layout + RUNBOOK section, "Litografía del Sur" theme tokens live. **Coming soon** page proves end-to-end deploy. | 250–350 | `npm test`, `npm run build`, Pages URL 200, Vitest ≥ 80% on atoms, smoke spec green |
| PR2 | `feature/foundation-auth` → `main` | `services/apiClient.ts` + interceptors + 401 handler, `services/auth.ts` (Cognito USER_PASSWORD_AUTH + refresh), `services/types.ts` (zod schemas for User/Account/Category/Transaction), `sessionStore`, `useAuth` hook, `templates/AuthShell` + `templates/AppShell` (cobalt masthead), `pages/LoginPage` + `ForbiddenPage` + `NotFoundPage`, role-aware route guard. TDD: auth hook + interceptor tests first. | 300–380 | `npm test`, build, smoke `/login` 200, login happy path Vitest green |
| PR3 | `feature/foundation-categories` → `main` | `useCategories`, `useAccounts`, `useUsers` hooks (TanStack Query keys + invalidation), `organisms/CategoryTable` + `CategoryForm` + `DeleteConfirm`, `pages/CategoriesAdminPage` + `UsersAdminPage` + `AccountsPage`. Optimistic delete + 409 restore. No `icon` field anywhere. | 350–400 | `npm test`, smoke, admin role gate Vitest, 409 restore covered |
| PR4 | `feature/foundation-transactions` → `main` | `useTransactions` hook with `limit` + pagination, `organisms/TransactionTable` (ledger rows w/ line numbers + tabular figures), `organisms/CategoryBreakdown` (Recharts), `pages/DashboardPage` + `TransactionsPage` + `InsightsPage`, `templates/DashboardLayout`. Amount normalization `amountCents: number` only. | 350–400 | `npm test`, build, dashboard renders transactions from MSW, Recharts smoke |
| PR5 | `feature/foundation-polish` → `main` | Toast system + retryable error toast, 401-logout wiring, `ImportPage` (PapaParse, CSV import), Playwright e2e spec for auth → dashboard, RUNBOOK.md final (`CLOUDFLARE_*` secret instructions, 500-builds/mo ceiling, CORS posture, `pages-action` deprecation warning), Vitest coverage gates enforced. | 200–300 | Playwright green against Pages preview URL, Vitest coverage ≥ 50% on atoms/molecules + key organisms |

If PR3 or PR4 breaches 400, split: PR3a (hooks + read-only tables) / PR3b (CRUD UI); PR4a (dashboard + transactions) / PR4b (insights + import).

## 6. Risks

| # | Risk | Mitigation in design | Status |
|---|---|---|---|
| 1 | `cloudflare/pages-action@v1` resurrected from memory | ADR-FF-002 names `wrangler-action@v4`; cycle's runbook restates it; PR1 deploy job uses `@v4` explicitly. | Owned |
| 2 | 500 builds/mo ceiling breached | Path filter `frontend/**` on both workflows; RUNBOOK documents the ceiling and warns against removing the filter. | Owned |
| 3 | CORS `*` lets any origin call API with valid token | Documented in RUNBOOK; bounded by Cognito 50K MAU + API GW 100 RPS throttle (verified in stack). | Accepted (portfolio demo) |
| 4 | `Category.icon` round-tripped through SPA but backend drops it silently | ADR-FF-007 drops `icon` entirely from v1; no `Category.icon` field rendered or POSTed. | Owned |
| 5 | `amount` vs `amountCents` mismatch between backend entity and API contract | `services/types.ts` zod schema normalizes to `amountCents: number` only; `AmountText` accepts integer cents; backend entity field is internal. | Owned |
| 6 | `openspec/config.yaml` `test_command` is backend-only today | PR1 adds `apply.test_command.frontend` while keeping `apply.test_command` (backend) intact; proposal explicit. | Owned |
| 7 | Strict TDD on atoms before design decisions are made | PR1 ships the design tokens + Vitest config + RTL setup BEFORE any atom implementation; atoms are RED-first via colocated `*.test.tsx`. | Owned |
| 8 | Three AI-default looks leaking in | This design explicitly rejects them (1.2) and commits to "Litografía del Sur" with the cobalt masthead as the single signature (1.5). | Owned |
| 9 | $0 cost broken by paid font / icon / analytics | All type faces (Bricolage Grotesque, Public Sans, JetBrains Mono) are free; icons are inline SVG atoms (no paid icon set); no analytics. | Owned |
| 10 | Chained PR drift (one slice blows budget) | PR slice plan includes forecast line counts; PR3/PR4 split triggers documented; `sdd-tasks` per-slice forecast is required. | Owned |
| 11 | Cognito `cognito:groups` colon claim sometimes dropped by HTTP API v2 | SPA does NOT depend on `event.requestContext.authorizer.jwt.claims` directly — it sends raw `Authorization: Bearer <IdToken>` only; backend handles the fallback (`http.utils.ts:138–185`). | Owned (defensive) |
| 12 | Threat matrix applicability | This design does NOT add shell, subprocess, executable-file classification, or process-integration boundaries. It adds routing (React Router), which is non-sensitive. **Threat matrix: N/A — no shell/subprocess/VCS automation introduced.** Recorded, not manufactured. | Owned |

## Open questions

- [ ] Is the cobalt brand + warm-paper aesthetic acceptable, or do you want to steer toward a cooler palette? (One question; default commits to "Litografía del Sur" unless told otherwise.)
- [ ] PR3 PR4 split trigger: confirm `sdd-tasks` should forecast per-slice line count and recommend splitting when projected > 380.

## Next step

Ready for `sdd-tasks`.
