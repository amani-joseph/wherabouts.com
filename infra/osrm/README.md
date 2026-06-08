# OSRM routing engine (Wherabouts)

Self-hosted OSRM serving the driving profile over the Australia OSM extract.
Backs `GET /api/v1/routing/directions` (the Worker proxies to it).

## Build the graph (local or CI; needs Docker + ~8GB RAM)

    ./build-graph.sh ./data

Produces `data/australia-latest.osrm*`.

## Deploy (Fly.io)

    fly volumes create osrm_data --region syd --size 10   # first time
    # copy the built graph onto the volume (fly sftp / a one-off machine)
    fly deploy

## Auth

`osrm-routed` has no native auth. The Worker authenticates via a shared
`OSRM_AUTH_TOKEN` checked by a tiny reverse-proxy (or Fly private networking so
only the Worker's egress reaches it). The Worker reads `OSRM_BASE_URL` +
`OSRM_AUTH_TOKEN` from env (see packages/env/src/server.ts).

## Refresh cadence

OSM drifts. Rebuild monthly: re-run build-graph.sh, redeploy. Automate later.

## Smoke test

    curl -H "authorization: Bearer $OSRM_AUTH_TOKEN" \
      "$OSRM_BASE_URL/route/v1/driving/144.9631,-37.8136;151.2093,-33.8688?overview=full&geometries=geojson"

Expect `code: "Ok"` and a `routes[0]` with distance/duration/geometry.
