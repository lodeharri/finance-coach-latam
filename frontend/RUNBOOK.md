# RUNBOOK — Finance Coach LATAM Frontend

> Status: **STUB**. Final version lands in PR5. This file documents the secrets and operational constraints that must never be committed.

## Secrets (GitHub → Settings → Secrets and variables → Actions)

| Secret | Purpose | Permission scope | Notes |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Pages deploy | `Account → Cloudflare Pages → Edit` (and recommended `Account → Account Settings → Read`) | **Never committed.** Provision at <https://dash.cloudflare.com/profile/api-tokens>. |
| `CLOUDFLARE_ACCOUNT_ID` | Account target | Account ID (right-side API panel of the Cloudflare dashboard) | Lower sensitivity but still secret-managed. |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | SPA build-time (Cognito client id) | Public at runtime, secret at build time | CDK output `UserPoolClientId`. |
| `AWS_REGION` | SPA build (Cognito region) | n/a | Already exists; reused. |

The existing `AWS_*` secrets (for the backend deploy job) are unchanged.

## 500 builds / month ceiling

Cloudflare Pages free tier allows **500 builds per month**. The deploy workflow path-filter (`paths: [frontend/**]`) MUST stay in place. Removing it or adding unrelated paths will burn the budget on backend-only commits. The runbook warning mirrors `design.md` §3.4.

## CORS posture

The backend API Gateway HTTP API v2 has `Access-Control-Allow-Origin: *`. Any site on the internet can call the API with a valid token. Bounded by:
- Cognito free tier (50K MAU)
- API Gateway throttle (100 RPS)

Acceptable for the portfolio demo. Do **not** ship this posture to a production multi-tenant system without scoping origins.

## `cloudflare/pages-action@v1` is DEPRECATED

The official GitHub Action for Cloudflare is `cloudflare/wrangler-action@v4`. The deprecated `pages-action@v1` was archived on 2024-10-21. Do not introduce it in new code. See <https://github.com/cloudflare/wrangler-action>.

## Smoke verification

After every deploy, the workflow curl-checks `https://finance-coach-latam.pages.dev` for a 200. The full e2e suite (PR5) runs against the Pages preview URL.

## Rollback

- Revert the merge commit → next push redeploys the previous build.
- Or use `wrangler pages deployments rollback <id>` from the Cloudflare dashboard / CLI.
