# Visual redesign — Litografía del Sur (two-pass plan)

This is the design document for the `feat/visual-redesign-litografia` branch.
It follows the two-pass process mandated by the frontend-design skill: brainstorm,
then critique against the three AI-default looks, then build.

The design ground rules are inherited from `openspec/changes/frontend-foundation/design.md §1.3`:

- Single saturated cobalt as the brand color.
- Signals (positive, negative, warning, failed) live in *named ink colors*, never the brand.
- Tabular lining figures on amounts.
- Ledger line numbering `N.º 0042`.
- $0 cost — no paid fonts, no paid icons, no analytics.

---

## Pass 1 — Brainstorm (per surface)

For each surface: (a) single job, (b) token subset, (c) signature element UNIQUE to that
surface, (d) layout in one sentence, (e) one unusual editorial choice that distinguishes
it from a generic SaaS.

### AppShell masthead
(a) Establish page identity and chrome in one glance. (b) `--ink-cobalto`, `--ink-paper`,
`--ink-paper-lift`. (c) **Engraved folio strip** — a small mono caption reading
`VOL. III · FOLIO 04` rendered in cobalt-deep, set above the page name like a
masthead date strip; paired with a 1 px tinta hairline beneath the bar. (d) Cobalt
band 56 px tall, pl-12 pr-20, asymmetric padding so the page name and folio feel
off-center. (e) The folio number is derived from the route segment so it changes
per page — a deliberate editorial conceit, not a real volume number.

### AppShell sidebar
(a) Show where you are in the system. (b) `--ink-paper-lift`, `--ink-tinta`,
`--ink-cobalto`. (c) **Ledger-numbered nav** — each link prefixed with a small
mono `01.`–`06.` line index, the active link having its index in cobalt with a
3 px cobalt left-rule. (d) 240 px wide, top-aligned, paper-lift background with a
1 px hairline separator on the right. (e) HexStamp appears in the masthead header
of the sidebar, not as a logo beside text — the stamp is the *integrity mark* and
it sits above the nav, alone.

### AppShell main content area
(a) Hold the page content with editorial breathing room. (b) `--ink-paper`,
`--ink-tinta`. (c) **Asymmetric gutter** — `pl-12 pr-20 py-12` on `>= md`, `px-6 py-8`
on mobile; the right gutter is wider than the left to mimic a magazine column. (d)
A single column with `max-w-screen-xl` so wide tables don't stretch to viewport. (e)
A faint paper-grain background fills the main area: a 1 px dotted grid in
`--ink-paper-press` at 8 px intervals at 50% opacity, perceptible only on close
inspection.

### AuthShell (login)
(a) Stage the sign-in moment. (b) `--ink-paper`, `--ink-paper-lift`,
`--ink-cobalto`, `--ink-tinta`. (c) **Engraved plate** — the card has a 4 px cobalt
top rule, a 1 px tinta hairline below the rule, the cobalt HexStamp above the title,
and the section title `EDICIÓN DE OTOÑO · 2026` as a kicker in mono above
`FINANZAS`. (d) Centered card, 420 px wide, paper-lift background, asymmetric
internal padding. (e) An asterism `* * *` in mono, centered, sits between the
title block and the form — a section divider that no generic SaaS uses.

### DashboardPage hero
(a) Land the page on the most legible number. (b) `--ink-tinta`, `--ink-paper-lift`,
`--ink-cobalto`. (c) **The big number with kicker and delta** — display face
`text-[104px]`, mono kicker `GASTO DEL MES · ENE 2026` above it in 10 px with
`tracking-[0.3em]`, delta line in mono below it. (d) Full-width card on top of the
12-column grid, p-10, with a 4 px cobalt left-rule. (e) The kicker is the *current
period in Spanish*; it changes with the date so the page always reads as a snapshot
of "right now", not a timeless dashboard.

### DashboardPage stats cards (compact)
(a) Surface the secondary counts quickly. (b) `--ink-paper-lift`, `--ink-tinta-mute`,
`--ink-positivo`, `--ink-negativo`, `--ink-fallo`, `--ink-alerta`. (c) **Compact
card with cobalt strip** — `border-l-4 border-ink-cobalto`, label in mono
uppercase 10 px, value in display 3xl, delta in 12 px in the named signal color. (d)
Three cards in the same row as the hero's right side. (e) Each card has a small
mono ordinal — `N.º 02 · TOP CATEGORY`, `N.º 03 · PENDING` — so the reader knows
where in the hierarchy they are looking.

### DashboardPage charts (donut + sparkline)
(a) Show distribution and trend at a glance. (b) `--ink-cobalto`, `--ink-tinta-soft`,
signal colors only for failure/pening slices. (c) **Asterism divider with kicker**
— each chart card has a `* * *` divider below the section title, set in mono
uppercase 10 px, with the chart container framed by a 1 px hairline. (d) Two
columns, donut left, sparkline right, both 280 px tall. (e) The donut center is
empty (no center label) — Recharts inner radius gives a true donut, not a pie
with a label. Empty value reads as "no center stage", which is editorial restraint.

### TransactionsPage header + table
(a) Browse the user's ledger. (b) `--ink-paper-lift`, `--ink-tinta`, `--ink-tinta-mute`,
`--ink-cobalto`. (c) **Kicker + count strip** — page title preceded by a mono
`LIBRO DIARIO · 2026` kicker, followed by the row count in mono `042 MOVIMIENTOS`.
The table head uses an *Engraved column rule* — 2 px solid tinta beneath thead. (d)
Asymmetric page header, table below in full main width. (e) The ledger line numbers
in mono `N.º 0042` are flush-right in the first column; this is the established
signature element, kept and emphasized.

### TransactionsPage form
(a) Capture one new transaction. (b) `--ink-paper-lift`, `--ink-cobalto`,
`--ink-tinta-soft`. (c) **Hairline-bordered input with mono caps label** —
`border-b border-ink-tinta bg-transparent px-0 py-2`, label as `<label
class="font-mono text-xs uppercase tracking-[0.2em]">` above. (d) Single column,
each field separated by an `* * *` asterism divider. (e) The amount field is the
only field with a `border-2 border-ink-cobalto` rectangle, in mono, so the eye
locks onto it first — the cost is the point.

### AccountsPage header + table
(a) List the user's accounts. (b) `--ink-paper-lift`, `--ink-tinta`, `--ink-cobalto`,
`--ink-tinta-mute`. (c) **Type glyph strip** — the type column renders as
`BANK | CASH | CARD` in mono uppercase, with the active value highlighted by a
1 px cobalt underline; the row prefix is `N.º 0001` ledger style. (d) Two-column
table, no actions column. (e) The table head uses the engraved 2 px tinta rule.

### AccountsPage form
(a) Add an account. (b) `--ink-paper-lift`, `--ink-tinta`, `--ink-cobalto`,
signal colors not used here. (c) **Custom radio squares** — three square radio
buttons `BANK`, `CASH`, `CARD`, each 32×32 with a cobalt inner square when
checked; not the browser default. (d) Single column, name first, then the radio
strip with a mono label above. (e) The radio squares are not buttons styled to
look like radios — they are squares in mono uppercase, like a tri-stamp selection.

### UsersAdminPage header + table
(a) Browse the user directory. (b) `--ink-paper-lift`, `--ink-tinta`, `--ink-cobalto`,
signal colors not used here. (c) **Email-as-line-item** — each row's email is in
mono, flush-left, with the name in display body to its right and the tier in mono
caps flush-right. (d) List (not table), each row a 1 px hairline below. (e) The
row prefix is `N.º 001` and the tier chip uses a paper-press background with mono
caps — not a colored chip, which is the established convention.

### UsersAdminPage form
(a) Invite a user. (b) `--ink-paper-lift`, `--ink-tinta`, `--ink-cobalto`. (c)
**Hairline input + custom select** — the tier field uses a custom select drawn
with a chevron in mono and a 1 px cobalt underline on focus. (d) Three rows:
email, name, tier. (e) An `* * *` asterism sits between the name field and the
tier field, not between every field — restraint over rhythm.

### InsightsPage header + period selector
(a) Frame the analytical view. (b) `--ink-paper-lift`, `--ink-cobalto`,
`--ink-tinta`. (c) **Custom period selector as engraved stamp** — the native
`<select>` is replaced by a button group styled as a strip: `ESTE MES | MES PASADO
| ÚLTIMOS 3 | ÚLTIMOS 6 | ÚLTIMOS 12`, the active one in cobalt-on-paper. (d)
Header has the page title with a mono kicker `TENDENCIAS · 12 MESES` above it. (e)
The period selector reads left-to-right in Spanish with a `|` separator, like a
broadsheet nav, not a dropdown.

### InsightsPage trend chart container
(a) Show the 12-month arc. (b) `--ink-paper-lift`, `--ink-cobalto`,
`--ink-tinta-soft`. (c) **Asterism divider above the chart** with a mono caption
`EJE TEMPORAL · 12 MESES` — a small editorial label that frames what the chart is
reading. (d) Single full-width chart, 280 px tall. (e) The Recharts Y axis is
hidden (already in place) and the X axis tick is set in mono — this is the
*minimal axis* editorial choice: remove what doesn't carry information.

### InsightsPage breakdown table
(a) Show where the money went by category. (b) `--ink-paper-lift`, `--ink-tinta`,
`--ink-tinta-mute`, signal colors. (c) **Sortable column headers in mono with
arrow markers** — column heads are mono uppercase 10 px with a `▲` / `▼` marker
indicating sort direction. The category column shows a CategoryPill with a
border-l-4 in the category's hex color. (d) Five columns: Category | Total |
Δ% | Δ abs | Count. (e) The Δ columns show `—` in tinta-mute when not yet
computed; the em-dash is an editorial choice (no value, no fake number).

### InsightsPage top merchants
(a) Show who got the money. (b) `--ink-paper-lift`, `--ink-tinta`,
`--ink-tinta-mute`. (c) **Rank prefix in mono cobalt** — `N.º 001` through
`N.º 010` in cobalt mono, merchant name in display body, amount in mono right,
count in mute mono right, dominant category pill at the far right. (d) Ten
rows, each 1 px hairline below. (e) The merchant name is set in display face,
not body — the rare moment the *display* face carries data, not chrome.

### Empty states across pages
(a) Direct the user to their next action. (b) `--ink-paper-lift`, `--ink-tinta`,
`--ink-cobalto`. (c) **Italic display headline** — the headline is set in display
italic with a mono kicker `SIN MOVIMIENTOS AÚN` above it, and the CTA is a cobalt
underline link in display body. (d) Card centered, p-10, asymmetric padding. (e)
The voice is *active* — "Log a transaction to see your monthly trend", never
"There's nothing here yet" — and the CTA is a cobalt underline link, not a
primary button. This is a deliberate *editorial restraint*: empty states are
whispers, not shouts.

### Form inputs globally
(a) Receive text. (b) `--ink-paper`, `--ink-tinta`, `--ink-tinta-mute`,
`--ink-cobalto`, `--ink-negativo`. (c) **Hairline-bordered input with mono caps
label** — `border-b border-ink-tinta bg-transparent px-0 py-2 font-body text-md`,
focus state lifts the border to cobalt-deep and adds a 2 px cobalt ring. (d)
Single column, label above, input below. (e) The label is `font-mono text-xs
uppercase tracking-[0.2em]`, never sentence case — a deliberate editorial voice.

---

## Pass 2 — Critique against the three AI-default looks

For each surface: (a) which AI-default look it could fall into, (b) why it does NOT,
(c) what the signature element is and why it serves the brief.

### AppShell masthead
(a) **Cream + serif + cobalt strip** — every Tailwind admin template does a
navy/colored bar at the top. (b) It does NOT fall into that look because the bar
is *only* `--ink-cobalto` (no gradients, no shadow), it carries a folio strip in
mono caps, the page name is in display bold with a 1 px tinta hairline beneath
the bar (not the standard shadow). (c) The engraved folio strip is the signature
because it tells the reader "this is a volume of a publication, not a screen".

### AppShell sidebar
(a) **Broadsheet hairline rules** — narrow left column with vertical rule. (b) It
does NOT fall into that look because the sidebar's active state is a 3 px cobalt
left rule (not a hairline), the nav items have mono line numbers (not icons), and
the HexStamp is rendered *above* the nav, alone, not beside text. (c) The
ledger-numbered nav is the signature because it treats navigation as a printed
table of contents, not an icon set.

### AppShell main content area
(a) **Broadsheet dense columns** — three-column content with hairline rules. (b)
It does NOT fall into that look because there is one column with asymmetric
padding (`pl-12 pr-20`) and a *paper-grain* texture overlay (not a hairline grid).
(c) The paper-grain texture is the signature because it's the closest you can get
to "this screen is a piece of paper" in CSS without images.

### AuthShell
(a) **Cream + serif + warm border** — the SaaS auth card. (b) It does NOT fall
into that look because the card has a 4 px cobalt top rule (not a 1 px generic
border), an asterism divider (never seen in auth), the title has a mono kicker
(`EDICIÓN DE OTOÑO · 2026`) and a mono brand mark `FINANZAS`, not a serif logo.
(c) The asterism divider is the signature — it's a piece of print typography that
no SaaS auth card uses, and it immediately signals "this is a publication".

### DashboardPage hero
(a) **Big number + small label + gradient accent** — the most generic hero in
AI output. (b) It does NOT fall into that look because there is no gradient, no
rounded corners, the label is in *mono caps with 0.3em tracking*, and the card has
a 4 px cobalt left-rule (the SaaS template uses a top accent or a gradient). (c)
The mono caps kicker `GASTO DEL MES · ENE 2026` is the signature because it
anchors the number to a specific moment in the user's life.

### DashboardPage stats cards (compact)
(a) **Compact rounded cards with icon + value** — the SaaS stat card. (b) It does
NOT fall into that look because the cards have a 4 px cobalt left-rule (not
rounded shadows), the value is in display bold (not a sans), the delta is in
*signal-named ink* (not the brand), and each card carries a mono ordinal
(`N.º 02 · TOP CATEGORY`). (c) The mono ordinal is the signature — it treats
secondary stats as a continuation of the same ledger, not a separate widget.

### DashboardPage charts (donut + sparkline)
(a) **Recharts default styling** — colorful donut, blue line, gray grid. (b) It
does NOT fall into that look because the donut slices use category hex colors
(explicitly NOT the Recharts default), the sparkline is cobalt-only with a
mono-tick X axis, and each chart is framed by an `* * *` asterism divider. (c)
The asterism divider with kicker is the signature — it's an editorial caption
that frames the chart, not a chart title.

### TransactionsPage header + table
(a) **Page title + table with hover row** — the SaaS data table. (b) It does NOT
fall into that look because the header has a mono `LIBRO DIARIO · 2026` kicker,
the table head uses an *engraved* 2 px tinta rule (not a 1 px gray), and the
ledger line numbers are flush-right mono `N.º 0042`. (c) The kicker + ledger
counter (`042 MOVIMIENTOS`) is the signature — it treats the table as a folio,
not a data grid.

### TransactionsPage form
(a) **Stacked inputs with floating labels** — the SaaS form. (b) It does NOT fall
into that look because every input is *hairline-bottom-only*, the label is mono
caps above the input (not floating), and the amount field is the *only* field
with a full cobalt-2 border, locking the eye. (c) The amount field's bordered
treatment is the signature — it says "the cost is the point" in design language.

### AccountsPage header + table
(a) **Two-column table with rounded badge** — the SaaS list. (b) It does NOT
fall into that look because the type column is `BANK | CASH | CARD` in mono caps
with a cobalt underline on the active value, and the row prefix is ledger style.
(c) The type glyph strip is the signature — it treats account type as a
classification stamp, not a tag.

### AccountsPage form
(a) **Stacked inputs + radio button group** — the SaaS form. (b) It does NOT
fall into that look because the radio is a *custom square* with a cobalt inner
square when checked (not a browser default), and the mono caps label reads as
`TIPO DE CUENTA`. (c) The custom radio square is the signature — it carries the
"stamp" metaphor from the AuthShell plate into a control.

### UsersAdminPage header + table
(a) **Table with action menu** — the SaaS admin list. (b) It does NOT fall into
that look because the rows are a *list* (not a table), the email is in mono
flush-left (not body), the tier is mono caps flush-right (not a chip), and the
header has a kicker `DIRECTORIO · USUARIOS`. (c) The email-in-mono + tier-in-mono
pair is the signature — it treats the user directory as a typeset index, not a
data grid.

### UsersAdminPage form
(a) **Stacked inputs + dropdown** — the SaaS form. (b) It does NOT fall into
that look because every input is hairline-bottom-only with a mono caps label,
and the tier select uses a custom chevron in mono (not the browser default). (c)
The custom tier select is the signature — it carries the chevron-drawn-in-mono
treatment from the period selector.

### InsightsPage header + period selector
(a) **Page title + dropdown select** — the SaaS filter. (b) It does NOT fall
into that look because the period selector is a *button group* styled as a
stamp strip (`ESTE MES | MES PASADO | ÚLTIMOS 3 | ÚLTIMOS 6 | ÚLTIMOS 12`), the
active one in cobalt-on-paper, and the header has a kicker `TENDENCIAS · 12
MESES`. (c) The period selector as a strip is the signature — it's a broadsheet
nav, not a dropdown.

### InsightsPage trend chart container
(a) **Chart with title above** — the SaaS analytics card. (b) It does NOT fall
into that look because the chart has an asterism divider *above* it with a mono
caption `EJE TEMPORAL · 12 MESES`, and the Y axis is hidden (already in place).
(c) The asterism + caption is the signature — it's a print-style chart caption,
not a chart title.

### InsightsPage breakdown table
(a) **Sortable data table** — the SaaS analytics table. (b) It does NOT fall
into that look because the column heads are mono caps with `▲`/`▼` markers
(not the browser default), the category column has a `border-l-4` in the
category's hex color, and the Δ columns show `—` (em-dash) in tinta-mute when
not yet computed. (c) The em-dash for un-computed values is the signature — it's
honest about what is not known, in print typography language.

### InsightsPage top merchants
(a) **Ranked list with badges** — the SaaS analytics list. (b) It does NOT fall
into that look because the rank prefix is `N.º 001` in cobalt mono (not a
gray number), the merchant name is in *display face* (rare use of display for
data), and each row has a 1 px hairline below. (c) The display-face merchant
name is the signature — the moment the display face carries data, not chrome.

### Empty states across pages
(a) **Centered illustration + "Nothing here yet" + primary button** — the SaaS
empty state. (b) It does NOT fall into that look because the headline is in
*display italic* with a mono kicker above it, the CTA is a cobalt underline link
(not a primary button), and the voice is active ("Log a transaction to see
your monthly trend"). (c) The display italic + cobalt underline link is the
signature — it treats the empty state as a printed dedication, not a marketing
moment.

### Form inputs globally
(a) **Stacked inputs with floating labels and shadow on focus** — the SaaS form.
(b) It does NOT fall into that look because every input is hairline-bottom-only
with a mono caps label above it, the focus state lifts the border to cobalt-deep
(not a glow), and the amount field has a full cobalt-2 border. (c) The
hairline-bottom + mono caps label is the signature — it reads as a printed
form, not a digital input.

---

## Token additions

The existing `src/styles/tokens.css` already has all the colors I need. To
support the new editorial patterns I will add:

| New token | Value | Why |
|---|---|---|
| `--ink-paper-grain` | `rgba(26, 24, 16, 0.04)` | Translucent overlay for the paper-grain texture on the main area. |
| `--text-4xl` | `6.5rem / 104px` | The hero number on DashboardPage needs to be bigger than `--text-3xl` (64 px). |
| `--text-display-italic` | `italic 700 2.5rem / 2.5rem` | The empty-state headline needs display-italic, used inline as `font-display italic`. |

All new tokens are ADDITIVE — no existing token is removed.

## What this PR will NOT do

- Will NOT add paid fonts or paid icon sets.
- Will NOT change functionality (REQ-FFC-* behavior remains intact; the `required`
  forwarding bug is fixed by adding `noValidate` to the affected forms so JS
  validation continues to run).
- Will NOT change the backend, infra, or deploy workflows.
- Will NOT introduce new top-level npm dependencies.
- Will NOT touch the test utilities, MSW handlers, or session store.

## Files I will change

Templates:
- `src/templates/AppShell.tsx` — masthead folio strip, hairline beneath cobalt bar.
- `src/templates/AuthShell.tsx` — kicker, asterism, hairline below rule.

Pages:
- `src/pages/LoginPage.tsx` — hairline-bordered input pattern.
- `src/pages/DashboardPage.tsx` — hero kicker, asterism dividers, mono ordinals on compact cards.
- `src/pages/TransactionsPage.tsx` — kicker, ledger counter strip.
- `src/pages/AccountsPage.tsx` — kicker, type glyph strip.
- `src/pages/UsersAdminPage.tsx` — kicker, email-as-line-item, custom tier select.
- `src/pages/InsightsPage.tsx` — kicker, custom period strip, asterism captions.

Organisms:
- `src/organisms/Sidebar.tsx` — ledger-numbered nav.
- `src/organisms/StatsCard.tsx` — kicker, mono ordinal, paper-grain background.
- `src/organisms/RecentTransactionsList.tsx` — kicker above the list.
- `src/organisms/TransactionTable.tsx` — engraved thead rule, kicker.
- `src/organisms/charts/SpendDonut.tsx` — asterism caption.
- `src/organisms/charts/MonthlySparkline.tsx` — asterism caption.

Atoms:
- `src/atoms/Button.tsx` — focus ring refinement, mono caps on size sm.
- `src/atoms/Input.tsx` — hairline-bottom-only variant (Editorial variant).
- `src/atoms/AmountInput.tsx` — keep bordered treatment (signature).
- `src/atoms/HexStamp.tsx` — add a "stamp" treatment (slight rotation, larger size on hover).
- `src/atoms/LogoutButton.tsx` — keep as-is, mono caps on hover.
- `src/atoms/Label.tsx` — keep as-is (mono caps is already the convention).

Molecules:
- `src/molecules/FormField.tsx` — **fix `required` forwarding bug**; add `noValidate` to
  the affected forms so JS validation continues to run.
- `src/molecules/TransactionForm.tsx` — hairline inputs, asterism dividers.
- `src/molecules/AccountForm.tsx` — custom radio squares, hairline name input.
- `src/molecules/UserForm.tsx` — hairline inputs, custom tier select.

Styles:
- `src/styles/tokens.css` — add `--ink-paper-grain`, `--text-4xl`, motion tweak.

## Risk and quality floor

- **Bundle size**: current main bundle ~101 KB gzipped, recharts split ~93 KB gzipped.
  Adding paper-grain + a few atoms/molecules should stay well under the 250 KB main limit.
- **TDD**: every changed component has a colocated test. The 273 passing tests must
  stay green; new tests are added for new behavior.
- **Accessibility**: cobalt focus ring on every interactive element; aria-labels
  preserved; `prefers-reduced-motion` honored via the motion tokens.
- **Responsive**: asymmetric padding collapses to `px-6 py-8` on mobile.
- **FormField bug**: the forwarding fix is real and verifiable. The AccountForm /
  TransactionForm / UserForm / LoginPage forms get `noValidate` so HTML5 doesn't
  block submit when JS validation surfaces a custom error message.
