#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${OSRM_AUTH_TOKEN:-}" ]]; then
	echo "OSRM_AUTH_TOKEN must be set" >&2
	exit 1
fi

# One osrm-routed per profile, each bound to localhost; Caddy (public :5000)
# gates by bearer token and routes /{service}/v1/{car|bike|foot}/ to the right
# instance by path segment.
osrm-routed --algorithm mld /data/car/australia-latest.osrm --max-table-size 10000 --ip 127.0.0.1 --port 5001 &
PID_CAR=$!
osrm-routed --algorithm mld /data/bike/australia-latest.osrm --max-table-size 10000 --ip 127.0.0.1 --port 5002 &
PID_BIKE=$!
osrm-routed --algorithm mld /data/foot/australia-latest.osrm --max-table-size 10000 --ip 127.0.0.1 --port 5003 &
PID_FOOT=$!

# If the container exits, take all three OSRM instances down with it.
trap 'kill "$PID_CAR" "$PID_BIKE" "$PID_FOOT" 2>/dev/null || true' EXIT

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
