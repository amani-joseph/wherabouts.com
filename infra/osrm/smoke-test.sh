#!/usr/bin/env bash
# End-to-end routing smoke test (Part F). Melbourne -> Sydney through the live API.
# Usage: ./smoke-test.sh wh_<your-api-key>
set -euo pipefail

API_KEY="${1:?Pass your wh_ API key as the first argument}"
BASE="https://api.wherabouts.com/api/v1/routing/directions"
URL="${BASE}?from=-37.8136,144.9631&to=-33.8688,151.2093"

echo "GET ${URL}"
echo "---"
curl -sS -i "$URL" -H "authorization: Bearer ${API_KEY}"
echo
