# OSRM Routing Engine — Deploy Guide

Step-by-step to bring the routing engine live so `GET /api/v1/routing/directions`
works end-to-end. Companion to [`README.md`](./README.md) (architecture/runbook).

The one genuinely fiddly part is getting the multi-GB prebuilt graph onto the Fly
**volume** — the image does **not** bake it in.

## Prerequisites

- Docker running, with **~8 GB RAM** allocated (Docker → Settings → Resources). The AU
  `osrm-extract` is memory-hungry.
- `flyctl` installed and authed: `brew install flyctl` then `fly auth login`.
- A token for `OSRM_AUTH_TOKEN`, e.g. `openssl rand -hex 32`. Keep it — the OSRM service
  and the Worker must use the **same** value.

---

## Part A — Build the routing graph locally

```bash
cd infra/osrm
./build-graph.sh ./data
```

Downloads `australia-latest.osm.pbf` from Geofabrik and runs extract → partition →
customize. Output: a set of `data/australia-latest.osrm*` files (several files sharing
that prefix). Takes 10–30 min. **Do not commit `data/`** (it's large; see `.gitignore`).

---

## Part B — Create the Fly app + volume

```bash
# from infra/osrm/
fly apps create wherabouts-osrm                       # matches `app` in fly.toml
fly volumes create osrm_data --region syd --size 10   # matches [[mounts]] source
```

---

## Part C — Populate the volume with the graph (the fiddly bit)

The container reads the graph from the mounted volume at `/data`, but the image doesn't
contain it. Populate the volume **before** the real app runs, or it crash-loops looking
for `/data/australia-latest.osrm`.

Most reliable method — tar the artifacts, push via a one-off machine:

```bash
cd infra/osrm/data
tar czf ../graph.tgz australia-latest.osrm*
cd ..

# Start a temporary machine with the volume mounted:
fly machine run --volume osrm_data:/data alpine sleep 3600   # note the machine ID printed

# Push the tarball in:
fly sftp shell
#   in the sftp shell:
put graph.tgz /data/graph.tgz
#   (exit the sftp shell)

# Extract on the machine, then destroy it:
fly ssh console --command "sh -c 'cd /data && tar xzf graph.tgz && rm graph.tgz && ls'"
fly machine destroy <that-machine-id> --force
```

After this, `/data` on the volume holds the `australia-latest.osrm*` files.

---

## Part D — Set the token + deploy

```bash
# from infra/osrm/
fly secrets set OSRM_AUTH_TOKEN=<your-token>    # Caddy + entrypoint read this
fly deploy
```

`fly deploy` builds the Dockerfile (installs Caddy); the entrypoint starts `osrm-routed`
on localhost:5001 with Caddy gating `:5000`. Public URL: `https://wherabouts-osrm.fly.dev`.

**Direct smoke test** (confirms engine + auth before touching the Worker):

```bash
# Should return code:"Ok" with a route:
curl -H "authorization: Bearer <your-token>" \
  "https://wherabouts-osrm.fly.dev/route/v1/driving/144.9631,-37.8136;151.2093,-33.8688?overview=full&geometries=geojson"

# Should return 403 Forbidden (proves auth is enforced):
curl -i "https://wherabouts-osrm.fly.dev/route/v1/driving/144.9631,-37.8136;151.2093,-33.8688"
```

---

## Part E — Wire the Worker (makes the API endpoint work)

The API Worker reads `OSRM_BASE_URL` + `OSRM_AUTH_TOKEN` from `serverEnv`. Set them on the
deployed Worker (`apps/server`):

```bash
cd apps/server
echo "https://wherabouts-osrm.fly.dev" | npx wrangler secret put OSRM_BASE_URL
echo "<your-token>" | npx wrangler secret put OSRM_AUTH_TOKEN
# redeploy so it picks them up:
pnpm -F @wherabouts.com/server deploy     # or: npx wrangler deploy
```

The token here **must equal** the one from Part D. `OSRM_BASE_URL` must have **no trailing
slash**.

---

## Part F — End-to-end smoke (Melbourne → Sydney through the API)

With a valid Wherabouts API key:

```bash
curl -H "authorization: Bearer wh_<your-api-key>" \
  "https://api.wherabouts.com/api/v1/routing/directions?from=-37.8136,144.9631&to=-33.8688,151.2093"
```

Expect `~870000` for `distance_m`, a `duration_s`, and a non-empty `geometry.coordinates`.
Then update `docs/superpowers/specs/2026-06-08-routing-mvp-design.md` status from
"live deploy pending infra" to fully done.

---

## Local development

For everyday local work you don't need a local engine — point the dev Worker at the
**live Fly app**. The API Worker reads `OSRM_BASE_URL` + `OSRM_AUTH_TOKEN` from `serverEnv`,
and both are **required** (`packages/env/src/server.ts`), so `wrangler dev` will fail schema
validation if they're absent.

**Option 1 — local Worker → remote Fly OSRM (recommended).** In `apps/server/.dev.vars`:

```bash
OSRM_BASE_URL=https://wherabouts-osrm.fly.dev
OSRM_AUTH_TOKEN=<same token as `fly secrets`>      # must match Part D
```

`.dev.vars` is gitignored, so the token is safe there. `OSRM_BASE_URL` must have **no
trailing slash**.

**Option 2 — fully local OSRM (offline, no Fly).** Run the engine in Docker against the
graph you built in Part A, then point at it:

```bash
# Use the SAME pinned image the graph was built with (build-graph.sh / Dockerfile).
# OSRM graph files are version-specific — `osrm/osrm-backend:latest` will reject a v5.27.1 graph.
docker run --rm -p 5001:5000 -v "$PWD/infra/osrm/data:/data" \
  ghcr.io/project-osrm/osrm-backend:v5.27.1 \
  osrm-routed --algorithm mld /data/australia-latest.osrm
```

```bash
# apps/server/.dev.vars
OSRM_BASE_URL=http://localhost:5001
OSRM_AUTH_TOKEN=anything        # raw container has no Caddy, so it's not checked —
                                # but the var must still be set to pass validation
```

The raw `osrm/osrm-backend` container has **no Caddy gate**, so the bearer token isn't
enforced locally; that gate only exists on the Fly deployment.

---

## Refresh cadence

OSM data drifts. Monthly: re-run Part A, then re-populate the volume (Part C) and
`fly deploy` (Part D). Automate later.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| App crash-loops, logs show "Cannot open file /data/australia-latest.osrm" | Volume not populated (Part C failed or wrong filename prefix). `fly logs`; re-check `/data`. |
| 403 from the API even with a valid key | `OSRM_AUTH_TOKEN` mismatch between Fly (Part D) and the Worker (Part E). |
| API returns `internal_error` | Worker can't reach OSRM. Check `OSRM_BASE_URL` (no trailing slash) and that the Fly app is up. |
| API returns `unprocessable` ("No drivable route") | Coords didn't snap to a road — expected for off-network points, not a deploy problem. |
| Build OOM-killed | Raise Docker's RAM allocation to 8 GB+. |
