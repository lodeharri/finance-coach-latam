# Cloudflare WAF — free-tier rate limit

The Cloudflare Free plan caps rate-limit rules at **1**. This directory
contains the single rule we deploy and the script that applies it.

## Files

| File | Purpose |
|------|---------|
| `waf-rate-limit.json` | Source of truth: rule definition (name, expression, rate, action) |
| `apply-waf.sh`        | Idempotent script that upserts the rule via Cloudflare API |
| `README.md`           | This file |

## What the rule does

- **Name:** `block-excessive-requests`
- **Action:** `block`
- **Scope:** every request that is NOT for `/favicon.ico`, `/assets/*`, `/index.html`, `/robots.txt`, or `/sitemap.xml` (so static assets don't count toward the bucket)
- **Rate:** 100 requests per 10 seconds per `ip.src`
- **Penalty:** blocked for 10 seconds once the rate is exceeded

100 req / 10 s is enough headroom for normal human browsing (a fast user
generating ~10 req/s for 10 s = 100 req hits the cap; they'd have to be
clicking aggressively). Bots and scrapers hit the cap fast and stop.

## How to apply manually

You need two values from the Cloudflare dashboard:

- `CLOUDFLARE_API_TOKEN` — create a token with **Zone → WAF → Edit** permission, scoped to the `finance-coach-latam.com` zone.
- `CLOUDFLARE_ZONE_ID` — visible on the zone overview page (right sidebar).

```bash
cd infra/cloudflare

# 1. Preview what would be sent (no API calls):
./apply-waf.sh --print-config

# 2. Show the curl commands without actually sending them:
./apply-waf.sh --dry-run

# 3. Apply for real:
CLOUDFLARE_API_TOKEN=... \
CLOUDFLARE_ZONE_ID=... \
  ./apply-waf.sh
```

The script is **idempotent**. If the rule already exists (matched by its
`description` field), it's updated in place via PUT. Otherwise it's
created.

## How to change the rule

1. Edit `waf-rate-limit.json` (the source of truth).
2. Run `./apply-waf.sh` locally to apply.
3. Commit and push — the GitHub Actions workflow applies it again.

## How the GitHub Actions workflow runs

`.github/workflows/apply-cloudflare-waf.yml` triggers on push to `main`
when any file under `infra/cloudflare/` (or the workflow itself)
changes. It reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` from
repository secrets.

You must add those two secrets to the repo before the workflow can run:

1. GitHub → Settings → Secrets and variables → Actions
2. New repository secret:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ZONE_ID`

## Free-tier constraints

- **One rule only.** Cannot deploy a second rule without removing this one or upgrading.
- **No `requests_to_origin`** in the rule config — this is fine for an SPA, where most requests are dynamic anyway.
- **`mitigation_timeout` of 10s** is the minimum free-tier value that produces "perform action during the selected duration" behavior (block for 10s then release). Setting it to `0` would switch to "throttle" mode, which is Enterprise-only for the `block` action.

## Why this matters

Even though our AWS API Gateway has per-route throttling (see
`infra/lib/finance-coach-stack.ts`), the Cloudflare edge sits in front
of the Pages deployment and is hit by:

- Search engine crawlers
- Link previewers (Slack, Twitter, WhatsApp, etc.)
- Bad bots and scrapers
- Bots probing for `/wp-admin.php`, `/.env`, etc.

Blocking them at the edge saves Neon Postgres + Lambda invocations we
would otherwise pay for. The free-tier AWS API Gateway throttling is
the second line of defense for legitimate-looking abuse that gets
through Cloudflare.

## Manual test plan

1. `bash -n infra/cloudflare/apply-waf.sh` — syntax check (should pass).
2. `./apply-waf.sh --print-config` — should print the JSON config.
3. `./apply-waf.sh --dry-run` — should print the curl commands without sending.
4. Set real env vars and `./apply-waf.sh` — should report success and the rule id.
5. Check Cloudflare dashboard → Security → WAF → Rate limiting rules — rule should appear.
6. Re-run `./apply-waf.sh` — should update in place (not duplicate).
