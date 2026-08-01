# Spec: frontend-flow-completion

## Purpose

Closes the gap between the deployed AWS backend (`initial-poc` R1–R10) and the
shipped frontend foundation (Categories admin only). Adds the
`PATCH /transactions/{id}` endpoint, completes the Transactions / Accounts /
Admin Users / Dashboard product flows, fixes the URL/CORS double-slash bug, and
extends the Litografía del Sur design system to every new surface. Existing
`REQ-FF-*` requirements from `2026-07-31-frontend-foundation` continue to apply;
this spec adds `REQ-FFC-*` for new behavior and modifies two backend domains
where override semantics were previously implicit.

## ADDED Requirements — `frontend-flow-completion`

### Requirement: Transaction category override (REQ-FFC-BE-PATCH-TRANSACTION)

The backend SHALL expose `PATCH /transactions/{id}` accepting `{ categoryId }`.
The handler MUST resolve the actor, load the transaction, call
`assertCanActAs(actor, transaction.userId)`, validate the category exists, and
update the row with the new `categoryId`. A non-owner non-admin actor MUST
receive HTTP 403 with `{ error: "forbidden" }`. A missing transaction MUST
return HTTP 404.

#### Scenario: owner overrides category
- GIVEN an authenticated owner with a `CATEGORIZED` transaction
- WHEN `PATCH /transactions/{id}` is called with `{ categoryId: "<new>" }`
- THEN the row's `categoryId` is updated, `status` stays `CATEGORIZED`, and the route returns 200 with the updated transaction

#### Scenario: admin overrides another user's category
- GIVEN an admin actor and a transaction owned by a different user
- WHEN `PATCH /transactions/{id}` is called
- THEN the route returns 200 and the row is updated (admin override)

#### Scenario: non-owner non-admin is rejected
- GIVEN a `user` actor and a transaction owned by another `user`
- WHEN `PATCH /transactions/{id}` is called
- THEN the route returns 403 with `{ error: "forbidden" }` and no DB write occurs

#### Scenario: unknown transaction id
- GIVEN an authenticated actor and `id` that does not exist
- WHEN `PATCH /transactions/{id}` is called
- THEN the route returns 404 with `{ error: "transaction not found" }`

### Requirement: PATCH validation (REQ-FFC-BE-PATCH-VALIDATION)

The PATCH endpoint SHALL reject bodies missing `categoryId` or with a
non-existent `categoryId` with HTTP 400 and a stable `{ error }` shape. The
existing `{ message, details }` validation contract MUST be preserved for
field-specific errors.

#### Scenario: missing categoryId
- GIVEN an authenticated owner
- WHEN `PATCH /transactions/{id}` is called with `{}`
- THEN the route returns 400 with `{ error: "Field \"categoryId\" is required" }`

#### Scenario: non-existent categoryId
- GIVEN an authenticated owner and a `categoryId` that resolves to no row
- WHEN `PATCH /transactions/{id}` is called
- THEN the route returns 400 with `{ error: "Category not found" }` and no write occurs

### Requirement: Merchant cache is preserved on user override (REQ-FFC-BE-PATCH-AUDIT)

The PATCH endpoint SHALL NOT invalidate `merchant_category_cache`. Explicit
user overrides update the canonical transaction row and MAY upsert the cache
as a learned merchant. The trade-off: an override on `merchant="Shell"` from
`transporte` to `compras` writes the new mapping so future `Shell` rows
auto-categorize to `compras`.

#### Scenario: explicit override updates the cache
- GIVEN a transaction with `merchant="Shell"` and `categoryId=<transporte>`
- WHEN the owner PATCHes `categoryId=<compras>`
- THEN the transactions row is updated AND the cache row for normalized `"shell"` now points to `<compras>`

#### Scenario: subsequent categorize call uses the new cache row
- GIVEN the cache now maps `"shell"` → `<compras>`
- WHEN `POST /transactions/{id}/categorize` runs for a fresh transaction with `merchant="Shell"`
- THEN the cache layer short-circuits and assigns `<compras>` without invoking the LLM

### Requirement: URL join helper (REQ-FFC-FE-URL-HELPER)

The frontend SHALL expose `joinUrl(base, path)` that strips a single trailing
slash from `base`, strips a single leading slash from `path`, and joins with
exactly one `/`. The helper MUST NOT introduce a protocol change, MUST
return `base` unchanged when `path` is empty, and MUST throw on non-string
inputs.

#### Scenario: trailing slash on base
- GIVEN `base = "https://api.example.com/"` and `path = "categories"`
- WHEN `joinUrl` is called
- THEN the result is `"https://api.example.com/categories"`

#### Scenario: leading slash on path
- GIVEN `base = "https://api.example.com"` and `path = "/categories"`
- WHEN `joinUrl` is called
- THEN the result is `"https://api.example.com/categories"`

#### Scenario: both present
- GIVEN `base = "https://api.example.com/"` and `path = "/categories"`
- WHEN `joinUrl` is called
- THEN the result is `"https://api.example.com/categories"` (no double slash)

#### Scenario: neither present
- GIVEN `base = "https://api.example.com"` and `path = "categories"`
- WHEN `joinUrl` is called
- THEN the result is `"https://api.example.com/categories"`

### Requirement: No more `${baseUrl}/path}` template strings (REQ-FFC-FE-CORS-FIX)

`apiClient` and every hook in `frontend/src/hooks/` SHALL construct request
URLs through `joinUrl(base, path)`. Template-literal interpolation of the
form `` `${baseUrl}/path` `` SHALL be removed from production code paths.
Tests retain literal URLs because they bypass `baseUrl`.

#### Scenario: hook uses joinUrl
- GIVEN any hook in `frontend/src/hooks/`
- WHEN its `queryFn` builds the request URL
- THEN the URL is `joinUrl(apiBaseUrl, path)` (or the hook's memoized equivalent)

#### Scenario: apiClient stays URL-agnostic
- GIVEN `apiClient.{get,post,patch,del}` callers
- WHEN a caller invokes them with a fully-formed URL
- THEN the client does not re-join or strip slashes — it passes the URL to `fetch` unchanged

### Requirement: Transactions list page (REQ-FFC-TX-LIST)

`TransactionsPage` SHALL list transactions for the current user (or the
admin-targeted `userId` via query param). The list SHALL paginate via the
`limit` query parameter, defaulting to 50. Loading, empty, and error states
are required and SHALL reuse the existing patterns from
`2026-07-31-frontend-foundation`.

#### Scenario: user opens Transactions
- GIVEN an authenticated user with at least one transaction
- WHEN the page mounts
- THEN a list of the user's transactions is rendered, ordered by `occurredAt` desc

#### Scenario: empty list
- GIVEN an authenticated user with zero transactions
- WHEN the page mounts
- THEN an actionable empty state renders (no spinner)

#### Scenario: list error
- GIVEN the `GET /transactions` call fails with a retryable error
- WHEN the page renders
- THEN the error state offers retry and the request can be reissued

### Requirement: Transaction create form (REQ-FFC-TX-CREATE-FORM)

`TransactionsPage` SHALL include a create form with `amountCents` (positive
integer input), `merchant` (required text), `occurredAt` (date picker defaulting
to today in the user's locale), `accountId` (select populated from
`/accounts`), and `notes` (optional textarea). Validation MUST match the
backend `{ message, details }` contract and surface inline beside the field.

#### Scenario: valid submit
- GIVEN a user with at least one account and a valid form
- WHEN the user submits
- THEN `POST /transactions` is called and the new row appears with `status: "PENDING"`

#### Scenario: invalid amountCents
- GIVEN a form with `amountCents = "abc"` or negative
- WHEN validation runs
- THEN the amount field shows `Field "amountCents" must be a positive integer` and submit is blocked

#### Scenario: missing accountId
- GIVEN a form without a selected account
- WHEN the user attempts submit
- THEN the account field shows `Field "accountId" is required`

#### Scenario: backend rejects field
- GIVEN the backend returns `{ message, details }` on a specific field
- WHEN the response is mapped
- THEN the field's inline error matches `details` verbatim

### Requirement: New transaction starts PENDING (REQ-FFC-TX-CREATE-STATUS)

After `POST /transactions`, the new row SHALL render with `status: "PENDING"`
until the backend's LLM pipeline assigns a category. The list SHALL NOT block
on the categorize call.

#### Scenario: brand-new transaction
- GIVEN a freshly created transaction
- WHEN it appears in the list
- THEN it shows the PENDING chip and exposes a `Recategorize` action

#### Scenario: LLM finishes categorizing
- GIVEN a `PENDING` transaction
- WHEN the user triggers `Recategorize` and the backend succeeds
- THEN the row updates to `CATEGORIZED` with the resolved category

### Requirement: Category override dropdown (REQ-FFC-TX-OVERRIDE)

On a `CATEGORIZED` row, clicking the category pill SHALL open a dropdown
populated from `useCategories`. Selecting a category SHALL PATCH the
transaction and update the list optimistically. A 403 MUST surface the
ForbiddenPage; a 404 MUST refresh the list.

#### Scenario: user picks a new category
- GIVEN a `CATEGORIZED` transaction owned by the user
- WHEN the user selects a different category from the dropdown
- THEN the list shows the new category immediately and a background PATCH fires

#### Scenario: 403 on override
- GIVEN a non-owner non-admin actor and another user's transaction
- WHEN the override PATCH returns 403
- THEN the page renders ForbiddenPage and no row mutation persists

#### Scenario: 404 on override
- GIVEN a stale transaction id that no longer exists
- WHEN the override PATCH returns 404
- THEN the list refetches and the stale row is removed

### Requirement: Recategorize button (REQ-FFC-TX-CATEGORIZE-BUTTON)

A `Recategorize` button SHALL appear on rows with `status` in `PENDING` or
`FAILED`. Clicking it SHALL call `POST /transactions/{id}/categorize`, show
optimistic state during the call, and update the row when the response
arrives.

#### Scenario: PENDING transaction
- GIVEN a `PENDING` transaction
- WHEN the user clicks `Recategorize`
- THEN a loading state appears on the row and the categorize call fires

#### Scenario: FAILED transaction recovers
- GIVEN a `FAILED` transaction and a successful categorize response
- WHEN the response resolves
- THEN the row updates to `CATEGORIZED` with the new category

### Requirement: Currency-formatted amount display (REQ-FFC-TX-AMOUNT-DISPLAY)

`amountCents` SHALL be rendered through `Intl.NumberFormat` with the user's
locale and the `ARS` currency. The display SHALL always show two decimals
and use the locale's grouping separator (e.g., `8.500,00 ARS` for `850000`
cents in `es-AR`).

#### Scenario: Argentine locale formatting
- GIVEN `amountCents = 850000` and locale `es-AR`
- WHEN the amount renders
- THEN the output is `"8.500,00 ARS"`

#### Scenario: zero amount
- GIVEN `amountCents = 0`
- WHEN the amount renders
- THEN the output is `"0,00 ARS"` (not blank, not negative)

### Requirement: Accounts list page (REQ-FFC-ACC-LIST)

`AccountsPage` SHALL list the authenticated user's accounts. Admins MAY pass
`?userId=<id>` to list another user's accounts. Loading, empty, and error
states reuse the foundation patterns.

#### Scenario: user opens Accounts
- GIVEN an authenticated user with at least one account
- WHEN the page mounts
- THEN the user's accounts are rendered in a list

#### Scenario: admin opens another user's accounts
- GIVEN an admin and `?userId=<other>`
- WHEN the page mounts
- THEN that user's accounts are rendered

### Requirement: Account create form (REQ-FFC-ACC-CREATE-FORM)

The form SHALL accept `name` (text, required) and `type` (select with
`BANK`, `CASH`, `CARD`). Validation MUST match the backend.

#### Scenario: valid submit
- GIVEN a user with a valid form
- WHEN submit fires
- THEN `POST /accounts` is called and the row appears

#### Scenario: invalid type
- GIVEN a type value not in `{ BANK, CASH, CARD }`
- WHEN submit fires
- THEN the type field shows `Field "type" must be BANK, CASH, or CARD`

### Requirement: Preselect new account in transaction form (REQ-FFC-ACC-AFTER-CREATE)

After successful account creation, the page SHALL refresh the list and, if a
transaction create form is mounted, preselect the newly created account.

#### Scenario: create account then transaction
- GIVEN the user creates a new account on `AccountsPage` and navigates to `TransactionsPage`
- WHEN the transaction form mounts
- THEN the new account is preselected in the `accountId` field

### Requirement: Admin Users list (REQ-FFC-USR-LIST-ADMIN)

`UsersPage` SHALL be admin-only. A non-admin actor SHALL receive
`ForbiddenPage` and no admin data SHALL be fetched. Loading, empty, and
error states follow the foundation patterns.

#### Scenario: admin opens Users
- GIVEN an admin actor
- WHEN the page mounts
- THEN `GET /users` runs and the user list renders

#### Scenario: non-admin opens Users
- GIVEN a `user` actor
- WHEN the page mounts
- THEN `ForbiddenPage` renders and `GET /users` is not issued

### Requirement: Admin user create form (REQ-FFC-USR-CREATE-ADMIN)

The form SHALL accept `email`, `name`, and `tier` (`BRONZE`, `SILVER`,
`GOLD`). Validation MUST match the backend.

#### Scenario: admin creates a user
- GIVEN an admin and a valid form
- WHEN submit fires
- THEN `POST /users` is called and the new row appears in the list

#### Scenario: tier not in enum
- GIVEN `tier = "PLATINUM"`
- WHEN submit fires
- THEN the tier field shows a backend-validation message and submit is blocked

### Requirement: Dashboard stat cards (REQ-FFC-DASH-STATS)

`DashboardPage` SHALL show four stat cards: total spent this month (sum of
`amountCents` WHERE `status = "CATEGORIZED"` AND `occurredAt >= start of
month` in the user's locale), top three categories by spend, count
`PENDING`, and count `FAILED`.

#### Scenario: month-to-date spend
- GIVEN CATEGORIZED transactions in the current month
- WHEN the dashboard renders
- THEN the stat card shows the sum in `Intl.NumberFormat` `ARS`

#### Scenario: no transactions yet
- GIVEN zero CATEGORIZED rows this month
- WHEN the dashboard renders
- THEN the spend card shows `"0,00 ARS"` and `PENDING`/`FAILED` counts show `0`

### Requirement: Recent transactions widget (REQ-FFC-DASH-RECENT-LIST)

The dashboard SHALL show the last five transactions via `?limit=5` and each
row SHALL navigate to `/transactions` on click.

#### Scenario: render five rows
- GIVEN more than five transactions for the user
- WHEN the dashboard mounts
- THEN the five most recent rows render

#### Scenario: click navigates
- GIVEN a rendered row
- WHEN the user clicks it
- THEN the router navigates to `/transactions`

### Requirement: Donut chart of monthly spend by category (REQ-FFC-DASH-DONUT)

The dashboard SHALL render a Recharts donut of CATEGORIZED spend this month,
grouped by category. Slice colors SHALL match the `color` field returned by
`GET /categories`. Slices whose value is `<1%` of the total SHALL aggregate
into an `Otros` slice.

#### Scenario: slice colors come from the category
- GIVEN categories with distinct `color` values
- WHEN the donut renders
- THEN each category slice uses its backend `color` hex

#### Scenario: small slices aggregate
- GIVEN a category with `<1%` of monthly spend
- WHEN the donut renders
- THEN its slice is folded into `Otros` and a tooltip explains the grouping

### Requirement: Sparkline of last six months (REQ-FFC-DASH-SPARKLINE)

The dashboard SHALL render a Recharts sparkline of total monthly spend for
the trailing six months. The X-axis is a short month label; the Y-axis is
total `amountCents`. With fewer than two data points, an empty state renders
in place of the chart.

#### Scenario: six data points
- GIVEN at least one CATEGORIZED transaction in each of the last six months
- WHEN the sparkline renders
- THEN six labeled points appear along the X-axis

#### Scenario: empty state
- GIVEN fewer than two data points
- WHEN the sparkline renders
- THEN a quiet empty state replaces the chart

### Requirement: Skeleton loaders, not spinners (REQ-FFC-DASH-LOADING)

While dashboard stats are computing, the page SHALL render skeleton
placeholders on the paper surface (cards, charts). Spinners SHALL NOT be
used on the dashboard per the design system direction.

#### Scenario: initial load
- GIVEN the dashboard mounts with no cached data
- WHEN the queries are pending
- THEN skeleton placeholders fill the card and chart slots

### Requirement: Charts are lazy-loaded (REQ-FFC-DASH-CHART-LAZY)

Donut and sparkline components SHALL be imported via `React.lazy` so the
initial bundle excludes Recharts. A `Suspense` boundary SHALL render a
skeleton while the chart chunk loads.

#### Scenario: chunk splits on route
- GIVEN the dashboard route loads
- WHEN the build emits the bundle
- THEN the chart code lives in a separate chunk loaded only when `DashboardPage` mounts

### Requirement: Insights page route (REQ-FFC-INSIGHTS-ROUTE)

A separate `/insights` route SHALL exist for any authenticated role
(`user` and `admin`). It SHALL render `InsightsPage` inside `AppShell` and
appear in the sidebar between Dashboard and Transactions. The page SHALL be
distinct from `DashboardPage` (glanceable summary at `/dashboard`,
deeper analytics at `/insights`).

#### Scenario: navigation
- GIVEN a user with role `user` or `admin`
- WHEN they click the "Insights" link in the sidebar
- THEN they navigate to `/insights` and the page renders

### Requirement: 12-month spending trend (REQ-FFC-INSIGHTS-TREND)

`InsightsPage` SHALL show a 12-month line chart of total monthly spend
(amountCents summed per month, status=CATEGORIZED only). Each month on the
X-axis is labeled "ENE 2026" style in JetBrains Mono. The current month
has a cobalt dot at the data point. The Y-axis uses tabular lining figures.

#### Scenario: 12 data points
- GIVEN at least 12 months of transactions exist
- WHEN the chart renders
- THEN 12 data points appear on the line with month labels

#### Scenario: fewer than 12 data points
- GIVEN fewer than 12 months of transactions
- WHEN the chart renders
- THEN available months are shown and missing months are gaps (not zeroed)

### Requirement: Per-category breakdown table (REQ-FFC-INSIGHTS-BREAKDOWN)

`InsightsPage` SHALL show a sortable table: one row per category with
total spend (current month), month-over-month delta (% and absolute), and
the count of transactions. Sortable by any column. Empty categories show
a muted row, not zero — distinguishes "no spend" from "no data".

#### Scenario: sort by total spend
- GIVEN the breakdown table renders
- WHEN the user clicks the "Total" column header
- THEN rows sort descending by total amountCents

### Requirement: Top merchants by spend (REQ-FFC-INSIGHTS-TOP-MERCHANTS)

`InsightsPage` SHALL show the top 10 merchants by total spend for the
current month, each row showing merchant name, total amountCents (currency
formatted), count of transactions, and the dominant category pill.

#### Scenario: fewer than 10 merchants
- GIVEN fewer than 10 distinct merchants in the current month
- WHEN the section renders
- THEN only the available merchants appear (no padding)

### Requirement: Insights period selector (REQ-FFC-INSIGHTS-PERIOD)

A period selector at the top of `InsightsPage` SHALL let the user toggle
between "Este mes" / "Mes pasado" / "Últimos 3 meses" / "Últimos 6 meses"
/ "Últimos 12 meses". All charts and tables on the page SHALL re-query
based on the selected period. Default: "Este mes".

#### Scenario: switching to "Últimos 12 meses"
- GIVEN the period selector changes to "Últimos 12 meses"
- WHEN the page re-renders
- THEN the trend shows 12 data points and the breakdown / top merchants aggregate over that period

### Requirement: Insights empty and loading states (REQ-FFC-INSIGHTS-STATES)

While data is loading, skeletons fill the chart and table slots. If the
selected period has no transactions, the page SHALL render an empty state
with active-voice copy: "No hay gastos en este período. Probá cambiar el
período o crear una transacción." plus a CTA linking to `/transactions`.

### Requirement: Logout button in masthead (REQ-FFC-FE-LOGOUT)

A `LogoutButton` SHALL render in the `AppShell` masthead (top-right area,
near the RoleBadge and the date) on every authenticated page. Clicking
the button SHALL:
1. Call `sessionStore.clear()` (the same clear path 401 takes in
   `apiClient.ts:106`).
2. Navigate to `/login`.

The button label SHALL read "Sign out" (active voice, per the
`frontend-design` skill writing guidance; "logout" is technical jargon).
The button MUST be keyboard accessible (Tab order, Enter/Space to
activate, visible focus ring), and MUST respect `prefers-reduced-motion`
for any state transition. It MUST NOT be role-gated — both `user` and
`admin` roles see it.

#### Scenario: click sign out
- GIVEN a user is authenticated on any page rendered inside `AppShell`
- WHEN the user clicks "Sign out"
- THEN `sessionStore` is cleared, the user is navigated to `/login`,
  and any subsequent API call returns 401 which is already handled

#### Scenario: keyboard activation
- GIVEN the user tabs to the "Sign out" button
- WHEN they press Enter or Space
- THEN the logout flow runs the same as a click

### Requirement: Sidebar role-aware navigation (REQ-FFC-FE-SIDEBAR-ROLE)

The sidebar MUST render only links the current role can access. Visible
links by role:
- `user`: Dashboard, Transacciones, Cuentas, Insights.
- `admin`: Dashboard, Transacciones, Cuentas, Insights, Categorías, Usuarios.

The sidebar MUST NOT show admin-only links to non-admin users
(REQ-FFC-USR-LIST-ADMIN and the existing CategoriesAdminPage's role guard
back this). Active link MUST have the cobalt left border treatment per
the established design baseline.

#### Scenario: user role sidebar
- GIVEN `session.role === 'user'`
- WHEN the sidebar renders
- THEN only Dashboard, Transacciones, Cuentas, and Insights links are visible

#### Scenario: admin role sidebar
- GIVEN `session.role === 'admin'`
- WHEN the sidebar renders
- THEN all six links are visible, with admin-only links after the user links

### Requirement: Atom test policy (REQ-FFC-TDD-ATOMS)

Atoms with logic (e.g., `CategorySelect`) MUST keep colocated tests. Pure
presentational atoms MUST share `atoms.trivial.test.tsx`. No atom SHALL ship
without at least one passing test.

#### Scenario: pure atom
- GIVEN a presentational atom with no state and no callbacks
- WHEN tests run
- THEN the test file is `atoms.trivial.test.tsx` and covers rendering

#### Scenario: atom with logic
- GIVEN an atom with controlled state or callbacks
- WHEN tests run
- THEN a colocated `Atom.test.tsx` exists alongside the implementation

### Requirement: Organism and hook test policy (REQ-FFC-TDD-ORGANISMS)

Organisms and hooks MUST ship with colocated `*.test.tsx` / `*.test.ts`
files. The colocated tests MUST precede implementation (RED-GREEN-REFACTOR)
and run under `cd frontend && npm test`.

#### Scenario: new organism
- GIVEN a new organism file
- WHEN reviewed
- THEN a colocated test exists, runs, and is green before the PR merges

### Requirement: API integration tests (REQ-FFC-TDD-INTEGRATION)

The `joinUrl` helper, every hook that calls `apiClient`, and any URL-join
behavior MUST be covered by tests with mocked MSW handlers. The tests
MUST assert the exact outgoing URL (no double slashes).

#### Scenario: hook test asserts joined URL
- GIVEN a hook with `apiBaseUrl = "https://x.test/"` and path `categories`
- WHEN the hook queryFn runs
- THEN the MSW handler receives a request at `https://x.test/categories` (single slash)

---

## MODIFIED Requirements — `authorization`

### Requirement: Transaction override authorizes as transaction owner (REQ-FFC-AUTH-TX-OWNER)

The system SHALL authorize `PATCH /transactions/{id}` by calling
`assertCanActAs(actor, transaction.userId)` AFTER loading the transaction,
not by trusting the route path. The use case MUST load the transaction
first, then run the authorization check against the row's `userId`. (Previously:
authorization was assumed at the route level using the request body's
`userId`, which could allow a user to spoof a different owner's row.)

#### Scenario: spoofed userId in body
- GIVEN a `user` actor and a transaction owned by user `B`
- WHEN `PATCH /transactions/{id}` is called with body `{ categoryId, userId: "<self>" }`
- THEN the use case still loads the transaction, sees `userId = B`, and rejects with `Forbidden`

---

## MODIFIED Requirements — `transaction-categorization`

### Requirement: Manual override path (REQ-FFC-TC-OVERRIDE)

The system SHALL expose a `PATCH /transactions/{id}` path that resolves the
actor's authority, validates the requested `categoryId`, writes the row, and
returns the updated transaction. The override path SHALL NOT invoke the
keyword, cache, embedding, or LLM layers — it is the explicit user decision.
The override MAY upsert the cache as a learned merchant (see
`REQ-FFC-BE-PATCH-AUDIT`). (Previously: the only categorization path was
`POST /transactions/{id}/categorize`, which delegated to the LLM pipeline.)

#### Scenario: override skips the LLM
- GIVEN any transaction state
- WHEN `PATCH /transactions/{id}` is called with a valid `categoryId`
- THEN the keyword, cache, embedding, and `generateText` layers are NOT invoked

---

## Notes on `admin-categories`

The proposal lists `admin-categories` as a modified capability. Reviewing
the existing spec, every contract surfaced by the new dashboard and
Transactions override flow (CRUD, hex color, slug uniqueness, cache
invalidation on update/delete) is already covered. No behavioral delta is
required; the modification is delivery-only (Recharts consumes the existing
`color` field). No `REQ-FFC-*` requirement is added under `admin-categories`.
