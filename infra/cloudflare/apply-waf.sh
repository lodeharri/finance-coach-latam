#!/usr/bin/env bash
#
# apply-waf.sh — Idempotently upsert the Cloudflare WAF rate-limit rule for
# the finance-coach-latam zone. Reads the rule definition from
# `waf-rate-limit.json` (single source of truth) and applies it to the zone's
# `http_ratelimit` phase entry-point ruleset.
#
# The Cloudflare Free plan allows exactly ONE rate-limit rule, so this
# script is the only rule we can deploy. If you need a second rule, upgrade
# the plan or remove this one first.
#
# Usage:
#   CLOUDFLARE_API_TOKEN=... \
#   CLOUDFLARE_ZONE_ID=... \
#   ./apply-waf.sh                 # apply the rule
#   ./apply-waf.sh --dry-run       # print curl commands without sending
#   ./apply-waf.sh --print-config  # print resolved rule JSON
#
# Environment:
#   CLOUDFLARE_API_TOKEN  required  API token with zone WAF edit permission
#   CLOUDFLARE_ZONE_ID    required  Zone ID (find via dashboard or `GET /zones`)
#
# Exits non-zero on any failure. Safe to re-run; existing rule with the
# same `description` is updated in place.

set -euo pipefail

# ── Resolve paths ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/waf-rate-limit.json"

if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "ERROR: config file not found at ${CONFIG_FILE}" >&2
  exit 1
fi

# ── Parse flags ────────────────────────────────────────────────────────────
DRY_RUN=false
PRINT_CONFIG=false

for arg in "$@"; do
  case "${arg}" in
    --dry-run)       DRY_RUN=true ;;
    --print-config)  PRINT_CONFIG=true ;;
    -h|--help)
      sed -n '2,28p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: ${arg}" >&2
      exit 2
      ;;
  esac
done

# ── Extract fields from config (jq is required) ───────────────────────────
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: 'jq' is required but not installed. Install with: sudo apt-get install jq" >&2
  exit 1
fi

RULE_NAME=$(jq -r '.name' "${CONFIG_FILE}")
RULE_DESCRIPTION=$(jq -r '.description' "${CONFIG_FILE}")
RULE_ACTION=$(jq -r '.action' "${CONFIG_FILE}")
RULE_EXPRESSION=$(jq -r '.expression' "${CONFIG_FILE}")
RATE_PERIOD=$(jq -r '.ratelimit.period' "${CONFIG_FILE}")
RATE_REQUESTS=$(jq -r '.ratelimit.requests_per_period' "${CONFIG_FILE}")
RATE_TIMEOUT=$(jq -r '.ratelimit.mitigation_timeout' "${CONFIG_FILE}")
RATE_CHARS=$(jq -c '.ratelimit.characteristics' "${CONFIG_FILE}")

# ── Handle --print-config BEFORE requiring env vars ───────────────────────
if [[ "${PRINT_CONFIG}" == "true" ]]; then
  jq '.' "${CONFIG_FILE}"
  exit 0
fi

# ── Validate env (only required for live API calls) ───────────────────────
if [[ "${DRY_RUN}" != "true" ]]; then
  : "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN env var is required}"
  : "${CLOUDFLARE_ZONE_ID:?CLOUDFLARE_ZONE_ID env var is required}"
else
  # Dry-run uses literal placeholder strings so curl commands are well-formed.
  export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-DRY_RUN_TOKEN}"
  export CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-DRY_RUN_ZONE_ID}"
fi

echo ">>> Applying WAF rule '${RULE_NAME}' to zone ${CLOUDFLARE_ZONE_ID}"

API_BASE="https://api.cloudflare.com/client/v4"

# ── Helper: send a request. Honors DRY_RUN. ───────────────────────────────
# Args: METHOD URL [JSON_BODY]
cf_request() {
  local method="$1"
  local url="$2"
  local body="${3:-}"

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[DRY-RUN] curl -sS -X ${method} '${url}' \\"
    if [[ -n "${body}" ]]; then
      echo "    -H 'Authorization: Bearer ${CLOUDFLARE_API_TOKEN}' \\"
      echo "    -H 'Content-Type: application/json' \\"
      echo "    --data '${body}'"
    else
      echo "    -H 'Authorization: Bearer ${CLOUDFLARE_API_TOKEN}'"
    fi
    # Return a benign empty success so set -e doesn't trip on the echo exit.
    return 0
  fi

  if [[ -n "${body}" ]]; then
    curl -sS -X "${method}" "${url}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "${body}"
  else
    curl -sS -X "${method}" "${url}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
  fi
}

# ── Step 1: Find the entry-point ruleset for the http_ratelimit phase ────
echo ">>> Looking up http_ratelimit phase entry-point ruleset"
ENTRYPOINT_URL="${API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/rulesets/phases/http_ratelimit/entrypoint"

# We need the HTTP status code separately, so use a temp file.
TMP_HTTP=$(mktemp)
trap 'rm -f "${TMP_HTTP}"' EXIT

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[DRY-RUN] GET ${ENTRYPOINT_URL}"
  echo ">>> (dry-run) assuming entrypoint exists; would fetch, then create-or-update rule"
  echo "Rule JSON that would be sent:"
  jq -c --arg desc "${RULE_DESCRIPTION}" \
        --arg action "${RULE_ACTION}" \
        --arg expr "${RULE_EXPRESSION}" \
        --argjson chars "${RATE_CHARS}" \
        --argjson period "${RATE_PERIOD}" \
        --argjson rpp "${RATE_REQUESTS}" \
        --argjson mt "${RATE_TIMEOUT}" \
    '{description:$desc, expression:$expr, action:$action, ratelimit:{characteristics:$chars, period:$period, requests_per_period:$rpp, mitigation_timeout:$mt}}' \
    "${CONFIG_FILE}"
  exit 0
fi

HTTP_STATUS=$(curl -sS -o "${TMP_HTTP}" -w '%{http_code}' \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  "${ENTRYPOINT_URL}")

if [[ "${HTTP_STATUS}" == "404" ]]; then
  echo ">>> Entry-point ruleset does not exist; will create with rule"
  RULESET_ID=""
elif [[ "${HTTP_STATUS}" == "200" ]]; then
  RULESET_ID=$(jq -r '.result.id' "${TMP_HTTP}")
  if [[ -z "${RULESET_ID}" || "${RULESET_ID}" == "null" ]]; then
    echo "ERROR: could not parse ruleset id from response:" >&2
    cat "${TMP_HTTP}" >&2
    exit 1
  fi
  echo ">>> Entry-point ruleset id: ${RULESET_ID}"

  # ── Step 2: check if our rule already exists (matched by description) ───
  EXISTING_RULE_ID=$(jq -r --arg desc "${RULE_DESCRIPTION}" \
    '.result.rules // [] | map(select(.description == $desc)) | first | .id // empty' \
    "${TMP_HTTP}")

  if [[ -n "${EXISTING_RULE_ID}" ]]; then
    echo ">>> Rule with description '${RULE_DESCRIPTION}' already exists (id=${EXISTING_RULE_ID}) — updating"
    UPDATE_BODY=$(jq -c --arg desc "${RULE_DESCRIPTION}" \
        --arg action "${RULE_ACTION}" \
        --arg expr "${RULE_EXPRESSION}" \
        --argjson chars "${RATE_CHARS}" \
        --argjson period "${RATE_PERIOD}" \
        --argjson rpp "${RATE_REQUESTS}" \
        --argjson mt "${RATE_TIMEOUT}" \
      '{description:$desc, expression:$expr, action:$action, ratelimit:{characteristics:$chars, period:$period, requests_per_period:$rpp, mitigation_timeout:$mt}}' \
      "${CONFIG_FILE}")

    UPDATE_RESPONSE=$(cf_request PUT \
      "${API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/rulesets/${RULESET_ID}/rules/${EXISTING_RULE_ID}" \
      "${UPDATE_BODY}")

    echo "${UPDATE_RESPONSE}" | jq '{success, errors, result: {id: .result.id, description: .result.description}}'
    echo ">>> Done (updated existing rule)"
    exit 0
  fi
else
  echo "ERROR: unexpected HTTP status ${HTTP_STATUS} when fetching entry-point ruleset:" >&2
  cat "${TMP_HTTP}" >&2
  exit 1
fi

# ── Step 3: create the entry-point ruleset (if missing) with our rule, OR
#            append our rule to the existing ruleset ───────────────────────
RULE_BODY=$(jq -c --arg desc "${RULE_DESCRIPTION}" \
    --arg action "${RULE_ACTION}" \
    --arg expr "${RULE_EXPRESSION}" \
    --argjson chars "${RATE_CHARS}" \
    --argjson period "${RATE_PERIOD}" \
    --argjson rpp "${RATE_REQUESTS}" \
    --argjson mt "${RATE_TIMEOUT}" \
  '{description:$desc, expression:$expr, action:$action, ratelimit:{characteristics:$chars, period:$period, requests_per_period:$rpp, mitigation_timeout:$mt}}' \
  "${CONFIG_FILE}")

if [[ -z "${RULESET_ID}" ]]; then
  echo ">>> Creating entry-point ruleset with the rule"
  CREATE_BODY=$(jq -c --arg name "${RULE_NAME}" \
    --argjson rule "${RULE_BODY}" \
    '{name:$name, kind:"zone", phase:"http_ratelimit", rules:[$rule]}' \
    <<<"{}")

  RESPONSE=$(cf_request POST "${API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/rulesets" "${CREATE_BODY}")
else
  echo ">>> Appending rule to existing entry-point ruleset"
  RESPONSE=$(cf_request POST "${API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/rulesets/${RULESET_ID}/rules" "${RULE_BODY}")
fi

echo "${RESPONSE}" | jq '{success, errors, result: {id: .result.id, description: .result.description}}'

SUCCESS=$(echo "${RESPONSE}" | jq -r '.success // false')
if [[ "${SUCCESS}" != "true" ]]; then
  echo "ERROR: Cloudflare API call failed. See response above." >&2
  exit 1
fi

echo ">>> Done"
