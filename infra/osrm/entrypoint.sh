#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${OSRM_AUTH_TOKEN:-}" ]]; then
	echo "OSRM_AUTH_TOKEN must be set" >&2
	exit 1
fi

# OSRM bound to localhost only; Caddy (public :5000) gates access by bearer token.
osrm-routed --algorithm mld /data/australia-latest.osrm --max-table-size 10000 --ip 127.0.0.1 --port 5001 &
OSRM_PID=$!

# If OSRM dies, take the container down too.
trap 'kill "$OSRM_PID" 2>/dev/null || true' EXIT

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
