#!/usr/bin/env bash
# Direct OSRM-on-Fly check. Isolates engine/Caddy/token from the Worker.
# Usage: ./osrm-check.sh <OSRM_AUTH_TOKEN>
set -euo pipefail

TOKEN="${1:?Pass the OSRM_AUTH_TOKEN as the first argument}"
HOST="wherabouts-osrm.fly.dev"
PIN="${2:-66.241.124.71}"   # pin shared v4 to bypass stale local DNS cache
BASE="https://${HOST}"
ROUTE="/route/v1/driving/144.9631,-37.8136;151.2093,-33.8688?overview=false"
RES=(--resolve "${HOST}:443:${PIN}")

echo "=== authed (expect 200 + code:Ok) ==="
curl "${RES[@]}" -sS -o /dev/null -w "HTTP %{http_code}\n" "${BASE}${ROUTE}" -H "authorization: Bearer ${TOKEN}"
echo "=== authed body (first 120 chars) ==="
curl "${RES[@]}" -sS "${BASE}${ROUTE}" -H "authorization: Bearer ${TOKEN}" | head -c 120; echo
echo "=== no-auth (expect 403) ==="
curl "${RES[@]}" -sS -o /dev/null -w "HTTP %{http_code}\n" "${BASE}${ROUTE}"
