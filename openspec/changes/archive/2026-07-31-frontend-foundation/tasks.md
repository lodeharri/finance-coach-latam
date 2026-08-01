# Tasks: frontend-foundation

> Layered chained PRs (scaffold → atoms/molecules → organisms/auth → pages → polish). Strict TDD: every UI task has a paired `[T]` test first, then `[I]` implementation. `frontend-design` skill is re-read at the start of every PR that touches UI.

> **Archive reconciliation (2026-07-31, by `sdd-archive`).** PR2–PR5 tasks were merged to `main` via PRs #31–#34 but their `[x]` checkboxes were never written back to this artifact by `sdd-apply`. `sdd-verify` independently confirmed completion (PASS WITH WARNINGS, 0 CRITICAL; backend 142/142, frontend 157/157 tests green; 8/8 ADRs honored). Per the `sdd-archive` skill's task-completion gate, the checkboxes were flipped to `[x]` with this note as the audit trail. The unchanged `[ ]` items in `proposal.md` (success metrics) and `design.md` (open questions) are not implementation tasks and remain as authored.

## TDD policy update (applied 2026-07-31)

User-mandated TDD policy replaces the per-component colocated-test default. It applies from PR2 onward and MUST be carried forward to PR3, PR4, and PR5.

- **Strict colocated `*.test.tsx`** per component (still mandatory):
  - All organisms, hooks, state, business logic.
  - `FormField` (validation, error mapping, label association).
  - `Toast` (ARIA live regions, focus management, auto-dismiss).
  - Any atom with real behavior: `Button` (variants, disabled, onClick), `Input` (types, controlled/uncontrolled), `HexStamp` (signature element with specific visual behavior).
- **Relaxed TDD — shared `atoms.trivial.test.tsx`** for pure presentational atoms with no state and minimal/no callbacks beyond `onClick`. As of PR2 these are: `Label`, `Badge`, `Spinner`. They share ONE test file. Each component still gets tested, just not in a colocated file.
- Apply this same relaxation to any future pure presentational atom or molecule with no logic.

Forecast line counts in the `Per-slice forecast` row below are stale; PR2 will land at ~1116 lines (vs the original 370 forecast) because of strict TDD on atoms + molecules. PR1 already received a `size:exception`. PR3+, if they approach >800 lines after applying the policy, must split per design.md triggers (`PR3a`/`PR3b`, `PR4a`/`PR4b`).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (total across 5 PRs) | ~1,760 |
| Per-slice forecast | PR1=350, PR2=370, PR3=380, PR4=380, PR5=280 |
| 400-line budget risk | Low (every slice ≤ 400) |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main (each PR merges to `main` in order) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Deploy pipeline + scaffold + tokens live on Pages | PR1 | `cd frontend && npm test` | `npm run build` + Cloudflare Pages URL returns 200 | Revert PR1 → workflow loses `deploy-frontend` job; backend job unaffected |
| 2 | Atoms + molecules with colocated tests | PR2 | `cd frontend && npm test -- src/atoms src/molecules` | `npm test` + Vitest coverage ≥80% on these dirs | Revert PR2 → atoms/molecules removed; tokens + deploy stay |
| 3 | API client + auth + first organisms (Categories admin) | PR3 | `cd frontend && npm test -- src/services src/hooks src/organisms` | Vitest + MSW handlers + zod-validated types | Revert PR3 → no API calls yet; LoginPage rendered without data |
| 4 | Pages + routing + role guards | PR4 | `cd frontend && npm test -- src/templates src/pages` | Vitest + RTL route tests | Revert PR4 → organisms + auth stay; pages fall back to Coming Soon |
| 5 | Playwright e2e + runbook finalize + polish | PR5 | `cd frontend && npx playwright test` | Playwright against Pages preview URL | Revert PR5 → loses e2e + runbook; production stays green |

---

## PR1 — Scaffold + deploy + tokens (no atoms)

- **Total estimated lines:** 350
- **Risk:** Low
- **Rollback:** Revert PR1; the `deploy-frontend` job disappears, backend deploy job unaffected, last Pages deployment keeps serving.
- **Verification:** `cd frontend && npm test && npm run build`, Cloudflare Pages URL returns 200, deploy workflow path-filter skips on backend-only commit.

### Tasks

- [x] PR1-T00: Re-read `frontend-design` skill (mandatory before any UI work in this slice). (~0 lines | docs)
- [x] PR1-T01: Scaffold Vite 5 + React 18 + TS strict (`tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; `vite.config.ts` with `@/*` alias; `frontend/index.html`; update `frontend/package.json` with `type: "module"`, scripts `dev/build/test/lint`, Node 24 engine). (~50 lines | config | REQ-FF-DEPLOY)
- [x] PR1-T02: Tailwind 3 + token layer (`styles/tokens.css` with `--ink-*` CSS variables from design §1.4; `tailwind.config.ts` mapping tokens to theme; `styles/tailwind.css` entrypoint with `@tailwind base/components/utilities`; `Litografía del Sur` cobalt-masthead palette live). (~120 lines | source | REQ-FF-ATOMS-BOUNDARY via no-API rule)
- [x] PR1-T03: ESLint + Prettier + Husky baseline (`.eslintrc.cjs` with `react`, `react-hooks`, `@typescript-eslint`, `jsx-a11y`; `.prettierrc`; `.husky/pre-commit` running `npm run lint && npm test`). (~50 lines | config | n/a)
- [x] PR1-T04: Vitest + RTL baseline (`vitest.config.ts` jsdom env, globals, setupFiles; `src/test/setup.ts` jest-dom matchers; `src/test/test-utils.tsx` with `renderWithProviders(ui, { route })`; `src/test/msw/handlers.ts` skeleton). (~50 lines | config | REQ-FF-STRICT-TDD)
- [x] PR1-T05: Playwright baseline (`playwright.config.ts` with chromium project, `baseURL` from `VITE_BASE_URL`; `e2e/smoke.spec.ts` empty passing test). (~30 lines | config | REQ-FF-FREE-DEPLOY via CI baseline)
- [x] PR1-T06: Gitignore updates (`frontend/.gitignore`: `dist/`, `node_modules/`, `.env*.local`, `coverage/`, `playwright-report/`, `test-results/`; root `.gitignore` add `frontend/dist`, `frontend/node_modules` defense-in-depth). (~10 lines | config | n/a)
- [x] PR1-T07: `openspec/config.yaml` add `apply.test_command.frontend: "cd frontend && npm test"` AND `verify.test_command_frontend`; keep `apply.test_command` (backend) intact. (~5 lines | config | n/a)
- [x] PR1-T08: `deploy-staging.yml` add `deploy-frontend` job (`cloudflare/wrangler-action@v4` — NOT `pages-action@v1`; `needs: deploy`, `if: needs.deploy.result == 'success'`; job-level `working-directory: frontend`; `permissions: contents: read, deployments: write`; Pages URL smoke). Workflow-level `paths:` filter adds `frontend/**`. (~60 lines | infra | REQ-FF-FREE-DEPLOY)
- [x] PR1-T09: `deploy-production.yml` mirror `deploy-frontend` job after `guard` + `deploy` succeed; same `wrangler-action@v4` + path filter; manual-dispatch only. (~40 lines | infra | REQ-FF-FREE-DEPLOY)
- [x] PR1-T10: Coming-Soon page (`src/pages/ComingSoonPage.tsx` using tokens only, no atoms yet), rewrite `frontend/README.md` to reflect new layered folder layout (per design §2.3), add `frontend/RUNBOOK.md` stub (sections: Secrets, 500 builds/mo ceiling, CORS posture, `pages-action` deprecation warning — filled out in PR5). (~60 lines | source+docs | n/a)

---

## PR2 — Atoms + molecules + RTL setup

- **Total estimated lines:** 370
- **Risk:** Low
- **Rollback:** Revert PR2; atoms/molecules removed, design tokens stay, deploy keeps working with Coming-Soon page.
- **Verification:** `cd frontend && npm test -- src/atoms src/molecules`, Vitest coverage ≥80% on atoms+molecules, `npm run build` green.

### Tasks

- [x] PR2-T00: Re-read `frontend-design` skill. (~0 lines | docs)
- [x] PR2-T01 [T]: Atom tests for `Button` (variants `primary|secondary|destructive`, sizes, disabled, focus ring uses `--ink-cobalto`), `Input` (controlled, `aria-invalid`, `aria-describedby`), `Label` (`htmlFor`, optional required indicator). Colocated `*.test.tsx`. (~30 lines | test | atom | REQ-FF-ATOMS-BOUNDARY)
- [x] PR2-T02 [I]: Implement `Button`, `Input`, `Label` atoms in `src/atoms/` using Tailwind token classes; no state, no API. (~45 lines | source | atom | REQ-FF-ATOMS-BOUNDARY)
- [x] PR2-T03 [T]: Atom tests for `Badge` (color variants: positivo/negativo/fallo/alerta/neutral; inline SVG icons only) and `Spinner` (`aria-busy`, reduced-motion respected). (~20 lines | test | atom | REQ-FF-RESILIENT-STATES via loading)
- [x] PR2-T04 [I]: Implement `Badge` and `Spinner` atoms. (~25 lines | source | atom | REQ-FF-RESILIENT-STATES)
- [x] PR2-T05 [T]: Atom test for `HexStamp` (signature element — 16×16 inline SVG hexagonal lattice, renders in cobalt, has `aria-hidden`). (~10 lines | test | atom | n/a — signature only)
- [x] PR2-T06 [I]: Implement `HexStamp` atom. (~15 lines | source | atom | n/a)
- [x] PR2-T07 [T]: Molecule tests for `FormField` (composes Label+Input, surfaces inline error from API `{message,details}` verbatim), `AmountText` (accepts integer `amountCents`, formats via locale-aware helper, tabular-nums + JetBrains Mono, signal color via `--ink-positivo|negativo`). (~30 lines | test | molecule | REQ-FF-ACCOUNTS-CRUD, REQ-FF-TRANSACTIONS)
- [x] PR2-T08 [I]: Implement `FormField` and `AmountText` molecules. (~40 lines | source | molecule | REQ-FF-ACCOUNTS-CRUD, REQ-FF-TRANSACTIONS)
- [x] PR2-T09 [T]: Molecule tests for `CategoryPill` (slug + name + hex color; inline swatch; no API), `Toast` (variants `info|success|error|retryable`; `role="status"` for non-error, `role="alert"` for error; auto-dismiss timer for non-error; reduced-motion respected). (~30 lines | test | molecule | REQ-FF-NETWORK-ERRORS)
- [x] PR2-T10 [I]: Implement `CategoryPill` and `Toast` molecules. (~45 lines | source | molecule | REQ-FF-CATEGORIES-CRUD, REQ-FF-NETWORK-ERRORS)
- [x] PR2-T11: Add `renderWithProviders` MSW server boot in `src/test/setup.ts`; ensure atom+ molecule tests pass in isolation. (~20 lines | test+config | n/a | REQ-FF-STRICT-TDD)
- [x] PR2-T12: Vitest coverage thresholds for `src/atoms/**` + `src/molecules/**` set to `lines: 80` in `vitest.config.ts`. (~5 lines | config | REQ-FF-STRICT-TDD)

---

## PR3 — Organisms + API client + auth

- **Total estimated lines:** 380
- **Risk:** Medium (first wired API calls; Cognito flow).
- **Rollback:** Revert PR3; no API calls yet, LoginPage from PR4 not built, deploy keeps serving Coming-Soon.
- **Verification:** `cd frontend && npm test -- src/services src/hooks src/organisms`, MSW handlers cover happy/401/409 paths, build green.

### Tasks

- [x] PR3-T00: Re-read `frontend-design` skill. (~0 lines | docs)
- [x] PR3-T01 [T]: `apiClient` test (`src/services/apiClient.test.ts`) — request includes `Authorization: Bearer <IdToken>` from session, parses JSON, validates with zod, on 401 fires `sessionStore.clear()` + navigates to `/login`, on 5xx returns `{ok:false, code}` for retryable toast, retries idempotent GETs once with backoff. (~40 lines | test | n/a | REQ-FF-AUTH-SESSION, REQ-FF-NETWORK-ERRORS)
- [x] PR3-T02 [I]: Implement `src/services/apiClient.ts` wrapping native `fetch` with interceptor chain + 401 handler + idempotent retry. (~55 lines | source | n/a | REQ-FF-AUTH-SESSION, REQ-FF-NETWORK-ERRORS)
- [x] PR3-T03 [T]: `auth.ts` Cognito service test (`USER_PASSWORD_AUTH` via `InitiateAuth` with `USERNAME/PASSWORD/AuthFlow/ClientId`; decodes IdToken payload for `sub/email/cognito:groups`; resolves `role = admins→'admin' else users→'user'`; `REFRESH_TOKEN_AUTH` before expiry; logout clears store). (~35 lines | test | n/a | REQ-FF-AUTH-SESSION)
- [x] PR3-T04 [I]: Implement `src/services/auth.ts` against `VITE_COGNITO_*` env; NEVER persist AccessToken (only IdToken + RefreshToken); 60s-before-expiry refresh. (~50 lines | source | n/a | REQ-FF-AUTH-SESSION)
- [x] PR3-T05 [T]: `services/types.ts` zod schema tests (User, Account, Category — NO `icon` field per ADR-FF-007; Transaction — `amountCents: number` integer only, normalizes `amount`→`amountCents` if backend ever returns the entity field). (~25 lines | test | n/a | REQ-FF-CATEGORIES-CRUD, REQ-FF-TRANSACTIONS, ADR-FF-007)
- [x] PR3-T06 [I]: Implement `src/services/types.ts` zod schemas + inferred TS types. (~30 lines | source | n/a | same as T05)
- [x] PR3-T07 [T]: `stores/sessionStore.ts` Zustand store tests (setTokens persists to localStorage; clearTokens removes; role derived from `cognito:groups`). (~20 lines | test | n/a | REQ-FF-AUTH-SESSION)
- [x] PR3-T08 [I]: Implement `src/stores/sessionStore.ts` Zustand slice with localStorage persist (IdToken + RefreshToken + role + expiry). (~25 lines | source | n/a | REQ-FF-AUTH-SESSION)
- [x] PR3-T09 [T]: `useAuth` hook tests (`login(email, password)`, `logout()`, `refreshIfNeeded()`, exposes `{status: 'idle'|'authenticating'|'authenticated'|'error', role, error}`). (~20 lines | test | hook | REQ-FF-AUTH-SESSION)
- [x] PR3-T10 [I]: Implement `src/hooks/useAuth.ts`. (~25 lines | source | hook | REQ-FF-AUTH-SESSION)
- [x] PR3-T11 [T]: `useCategories` hook tests (TanStack Query keys, `useMutation` create/update/delete with optimistic delete + 409 restore). (~20 lines | test | hook | REQ-FF-CATEGORIES-CRUD)
- [x] PR3-T12 [I]: Implement `src/hooks/useCategories.ts` with optimistic-delete + 409-restore logic. (~25 lines | source | hook | REQ-FF-CATEGORIES-CRUD)
- [x] PR3-T13 [T]: `CategoryTable` organism tests (lists via `useCategories`, renders CategoryPill + DeleteConfirm; on 409 shows inline conflict message and restores row). (~20 lines | test | organism | REQ-FF-CATEGORIES-CRUD)
- [x] PR3-T14 [I]: Implement `src/organisms/CategoryTable.tsx`. (~30 lines | source | organism | REQ-FF-CATEGORIES-CRUD)

---

## PR4 — Pages + routing + role guards

- **Total estimated lines:** 380
- **Risk:** Medium (routing surface + role-based access).
- **Rollback:** Revert PR4; organisms + auth stay wired, Coming-Soon page restored as root.
- **Verification:** `cd frontend && npm test -- src/templates src/pages`, build green, manual click-through of login → dashboard works against deployed Pages URL with mock data.

### Tasks

- [x] PR4-T00: Re-read `frontend-design` skill. (~0 lines | docs)
- [x] PR4-T01 [T]: Router + role-guard tests (`src/app/router.test.tsx`) — unauthenticated request to `/dashboard` redirects to `/login`; user role on `/admin/*` renders 403 (NEVER requests admin data); admin role on `/admin/*` renders page. (~30 lines | test | n/a | REQ-FF-ROLE-SAFE-ROUTING)
- [x] PR4-T02 [I]: Implement `src/app/router.tsx` with React Router v6 data routes; `RequireAuth` + `RequireRole('admin')` guards; `ForbiddenPage` redirect target for role mismatch. (~50 lines | source | n/a | REQ-FF-ROLE-SAFE-ROUTING)
- [x] PR4-T03 [T]: `AppShell` + `AuthShell` template tests (`AppShell` renders cobalt masthead 48px with Bricolage Grotesque page name + JetBrains Mono date + HexStamp; `AuthShell` centered paper card). (~25 lines | test | template | REQ-FF-ATOMS-BOUNDARY)
- [x] PR4-T04 [I]: Implement `src/templates/AppShell.tsx` (cobalt masthead + paper canvas + reduced-motion respected) and `src/templates/AuthShell.tsx`. (~45 lines | source | template | REQ-FF-ATOMS-BOUNDARY)
- [x] PR4-T05 [T]: `LoginPage` tests (renders FormField for email/password, calls `useAuth.login`, surfaces inline error from Cognito on failure, redirects to `/dashboard` on success; never reads tokens from URL). (~25 lines | test | page | REQ-FF-AUTH-SESSION)
- [x] PR4-T06 [I]: Implement `src/pages/LoginPage.tsx` inside `AuthShell`. (~30 lines | source | page | REQ-FF-AUTH-SESSION)
- [x] PR4-T07 [T]: `ForbiddenPage` + `NotFoundPage` tests (Forbidden shows 403 message + link back; NotFound shows 404 + link home; neither makes API calls). (~15 lines | test | page | REQ-FF-ROLE-SAFE-ROUTING)
- [x] PR4-T08 [I]: Implement `src/pages/ForbiddenPage.tsx` and `src/pages/NotFoundPage.tsx`. (~20 lines | source | page | REQ-FF-ROLE-SAFE-ROUTING)
- [x] PR4-T09 [T]: `ComingSoonPage` (PR1) retest inside `AppShell` — confirms masthead renders, links still work. (~5 lines | test | page | n/a)
- [x] PR4-T10 [I]: Wire `ComingSoonPage` inside `AppShell`; export `App` from `src/app/App.tsx` with `QueryClientProvider` + `RouterProvider`. (~25 lines | source | page+app | n/a)
- [x] PR4-T11: Mount `RoleBadge` molecule inline in `AppShell` masthead (visible signal of `admin|user`; tests for it). (~15 lines | test+source | molecule | REQ-FF-ROLE-SAFE-ROUTING)
- [x] PR4-T12: Vitest coverage on `src/templates/**` + `src/pages/**` set to `lines: 70`; add `router` to `vitest.config.ts`. (~5 lines | config | REQ-FF-STRICT-TDD)

---

## PR5 — Playwright e2e + runbook + polish

- **Total estimated lines:** 280
- **Risk:** Low (additive — e2e, docs, thresholds).
- **Rollback:** Revert PR5; loses e2e spec + runbook finalize + coverage gates; production stays green.
- **Verification:** `cd frontend && npx playwright test` against Pages preview URL green; `npm test -- --coverage` meets thresholds.

### Tasks

- [x] PR5-T00: Re-read `frontend-design` skill. (~0 lines | docs)
- [x] PR5-T01 [T]: Playwright `e2e/auth.spec.ts` — auth → dashboard happy path (uses Pages preview URL from `BASE_URL` env; login with seeded Cognito test user; expects cobalt masthead + Dashboard heading + Spinner visible during initial fetch). (~40 lines | test | e2e | REQ-FF-AUTH-SESSION)
- [x] PR5-T02 [T]: Playwright `e2e/admin-403.spec.ts` — user role attempts `/admin/categories` → expects ForbiddenPage, no API call to `/categories` POST. (~30 lines | test | e2e | REQ-FF-ROLE-SAFE-ROUTING)
- [x] PR5-T03 [I]: Wire `useToast` hook + global `<ToastHost/>` mounted in `AppShell`; `apiClient` 5xx → retryable toast; 401 already routes to `/login`; categories 409 → inline conflict. (~30 lines | source | hook+organism | REQ-FF-NETWORK-ERRORS, REQ-FF-CATEGORIES-CRUD)
- [x] PR5-T04: Finalize `frontend/RUNBOOK.md`: Secrets table (`CLOUDFLARE_API_TOKEN` Pages:Edit, `CLOUDFLARE_ACCOUNT_ID`, build-time `VITE_COGNITO_USER_POOL_CLIENT_ID`, `VITE_COGNITO_REGION`), 500-builds/mo ceiling with explicit warning that removing `paths:` filter burns the budget, CORS `*` posture (bounded by Cognito 50K MAU + API GW 100 RPS), `cloudflare/pages-action@v1` deprecation banner pointing at `wrangler-action@v4`. (~50 lines | docs | n/a)
- [x] PR5-T05: Enforce Vitest global thresholds `lines/functions/statements/branches: 50` in `vitest.config.ts` (matches backend); per-layer overrides stay (atoms/molecules 80, templates/pages 70). (~5 lines | config | REQ-FF-STRICT-TDD)
- [x] PR5-T06: Polish — `prefers-reduced-motion` media query in `styles/tokens.css` disables transitions + Spinner rotation; verify tab-order on LoginPage and ComingSoonPage. (~15 lines | source | n/a)
- [x] PR5-T07: Final verification — run `cd frontend && npx playwright test` against live Pages preview; record run id in `openspec/changes/frontend-foundation/verify-report.md` (sdd-verify phase). (~5 lines | docs | REQ-FF-FREE-DEPLOY smoke proof)
- [x] PR5-T08: Update root `README.md` with link to deployed Pages URL + frontend quickstart (`cd frontend && npm install && npm run dev`). (~10 lines | docs | n/a)

---

## Notes for sdd-apply

- All five PRs are base = `main`, stacked. No feature-branch chain needed.
- `frontend-design` skill MUST be re-read at PR1-T00, PR2-T00, PR3-T00, PR4-T00, PR5-T00 (per user mandate).
- Strict TDD enforced: never merge a PR with `[I]` tasks whose `[T]` counterpart is unchecked.
- `Category.icon` is OUT OF SCOPE for v1 (ADR-FF-007). If a `[T]` or `[I]` task accidentally references it, reject the PR.
- `cloudflare/wrangler-action@v4` is the only allowed action name. Reject any reference to `pages-action@v1`.
- `openspec/config.yaml` MUST keep `apply.test_command` (backend) intact; only add `apply.test_command.frontend`.