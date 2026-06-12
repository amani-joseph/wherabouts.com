---
phase: 10-advanced-routing
plan: 03
status: complete (code + unit tests); live OSRM smoke pending deploy
date: 2026-06-12
---

# 10-03 Summary — GPS map-matching

## What shipped (both tasks, committed)

| Task | Commit | Result |
|------|--------|--------|
| 1 — `fetchOsrmMatch` + `no_match` kind | `ae7a445` | `fetchOsrmMatch` calls OSRM `/match/v1/{profile}/{coords}` (geojson, overview=full, optional timestamps/radiuses/gaps/tidy) → `{ matchings, tracepoints }`, **null outliers preserved**. New `RoutingErrorKind "no_match"` (NoMatch → 422) distinct from `unavailable` (→500). `osrmRequest` service union widened to `route\|table\|match`. |
| 2 — `/api/v1/routing/match` | `a2fd602` | **POST** endpoint (D5): `profile` + `coordinates[{lat,lng,timestamp?,radius?}]` (min 2) + `gaps` + `tidy`. `buildMatchArrays` (pure, exported, unit-tested) splits per-point timestamp/radius into parallel arrays, enforcing all-or-none + strictly-increasing timestamps. Registered as `routing.match`. |

**Verification:** `pnpm -F @wherabouts.com/api test` → **109/109** green; `check-types` clean; ultracite clean.

## SC #4 status
✅ **Code-complete** — `/match` snaps a multi-point trace via OSRM `/match`, returns matchings + tracepoints (null outliers kept), `NoMatch`→422 vs service→500, uses the profile-aware bound-fetch client. Live OSRM smoke deferred to deploy (no OSRM in vitest).

## Decisions
- **D5 (match) → POST** — GPS traces can be long; JSON body validates normally (no `z.coerce`).
- Timestamps/radiuses are **all-or-none** across points (OSRM requirement); timestamps must be strictly increasing → 400 otherwise.
- POST ⇒ **docs-only** in the GET-only API-explorer allowlist (per `[[api-explorer-proxy-get-only-allowlist]]`) — not added to the GET allowlist.

## Test convention / deferrals
Pure helpers unit-tested (`buildMatchArrays`: split, all-or-none, monotonicity; `fetchOsrmMatch`: happy/null-outlier/`no_match`/`unavailable`/URL-forwarding). Endpoint-level NoMatch→422 / OSRM→500 mapping is identical to the proven `directions` path; full HTTP assertions deferred to live smoke (no oRPC harness).

## Follow-ups
- Live smoke post-deploy: `POST /api/v1/routing/match` with a short Melbourne trace → expect matchings + tracepoints.
- SDK `routing.match` method + types → plan **10-05**.
- Shares the OSRM-deploy dependency (foot/bike graphs + volume migration) with 10-01/10-02.
