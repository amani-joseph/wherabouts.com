# Phase 10 Context — Advanced routing (matrix · multi-profile · isochrones · map-matching · optimisation)

## Goal

Take routing from "point-to-point driving directions" to **Mappify/Mapbox parity**: N×M
duration/distance matrices, walking/cycling profiles, reachability isochrones, GPS map-matching,
and route optimisation (TSP/VRP) — all on the **existing self-hosted OSRM + Neon PostGIS**, with
each new endpoint mirrored by an SDK method + tests.

This phase is purely **additive**. The live `/api/v1/routing/directions` endpoint and its
contract must not regress.

## Current state (verified in code, 2026-06-11)

### API layer

`packages/api/src/routers/public/routing.ts`
- One procedure: `routingDirections` — `GET /api/v1/routing/directions`.
- Guarded by `apiKeyAuth` + `usageMiddleware("routing.directions")` (the standard public-API
  middleware stack used by every endpoint).
- Input schema uses **`z.coerce.number()`** for `fromAddressId`/`toAddressId` — bare `z.number()`
  would 400 every GET request (oRPC OpenAPI does not auto-coerce query/path params).
- `profile` is currently `z.literal("driving").default("driving")` — hard-locked to driving.
- Resolves `from`/`to` from either a `"lat,lng"` string or a G-NAF `addressId`; exactly one of
  each must be supplied (the `resolveEndpoint` helper enforces this).
- On OSRM failure it maps `RoutingError("no_route")` → `UNPROCESSABLE_CONTENT` and any other
  `RoutingError` → `INTERNAL_SERVER_ERROR` ("Routing service unavailable.").

`packages/api/src/shared/routing-queries.ts`
- `fetchOsrmRoute(from, to, options)` — **hardcodes** `/route/v1/driving/${coords}` and
  `overview=full&geometries=geojson`. Returns `{ distance_m, duration_s, geometry }`.
- `OsrmOptions = { baseUrl, authToken, fetchImpl }`.
- The handler passes `fetchImpl: globalThis.fetch.bind(globalThis)` — **binding is mandatory**;
  Workers' native fetch throws "Illegal invocation" when invoked as a free `options.fetchImpl`.
- Auth to OSRM is a bearer token: `headers: { authorization: "Bearer <OSRM_AUTH_TOKEN>" }`
  (Caddy in front of OSRM enforces it; `osrm-routed` binds to localhost only).
- Exports also: `parseLatLng`, `resolveAddressCoords`, `RoutingError`, `RoutingErrorKind`,
  `LatLng`, `GeoJsonLineString`, `DirectionsResult`.

`packages/api/src/routers/public-http.ts`
- Registers procedures into the OpenAPI router. Routing block today:
  ```
  routing: {
    directions: routingDirections,
  }
  ```
- New procedures get imported here and added under the `routing:` object. The frontend API
  explorer endpoint allowlist must stay in sync (memory: "API explorer proxy GET-only
  allowlist") — non-GET endpoints are docs-only there.

### Env

`packages/env/src/server.ts` exposes **only** `OSRM_BASE_URL` (url) and `OSRM_AUTH_TOKEN`
(min 1). No per-profile base URLs and **no VROOM config** exist yet — both are net-new if needed.

### PostGIS (Neon)

Used heavily already: `ST_SetSRID`, `ST_MakePoint`, `ST_Covers`, `ST_Contains`, `ST_Within`,
`ST_DWithin`, `ST_Distance`, `ST_AsGeoJSON`, `ST_GeomFromGeoJSON`, `ST_MakeEnvelope`,
`ST_IsValid`. Pattern: raw `sql\`...\`` fragments inside Drizzle queries (see
`packages/api/src/shared/region-queries.ts` → `regionsContainingPoint`, which is also the
reference for **ABS-region overlap** via the `regions` table + `regions.geom`).
- **No `ST_ConcaveHull` or `ST_ConvexHull` usage anywhere yet** — isochrone hull is new ground.

### OSRM infra (`infra/osrm/`)

- `Dockerfile` → `ghcr.io/project-osrm/osrm-backend:v5.27.1` (amd64), `osrm-routed` behind Caddy
  (bearer-token gate). `entrypoint.sh` runs `osrm-routed` on localhost:5001 + Caddy public.
- `build-graph.sh` builds **only the car graph**: `osrm-extract -p /opt/car.lua` →
  `osrm-partition` → `osrm-customize`, producing `australia-latest.osrm*`.
- Self-hosting/sizing in `SELF-HOSTING.md` and `DEPLOY.md` (Fly.io `syd`, ~3–4 GB RAM/profile to
  serve). Wiring is `wrangler secret put OSRM_BASE_URL/OSRM_AUTH_TOKEN`.

### SDK (`packages/sdk/`)

- `src/resources/routing.ts` — `createRouting(request)` factory returning `{ directions }`. Uses
  the `Requester` contract (`method`, `path`, `query`, optional `body`, `...CallOptions`).
- Registered in `src/client.ts` (`routing: createRouting(request)`, typed `routing: RoutingResource`)
  and re-exported in `src/index.ts`.
- Reference pattern for a clean single-method resource: `src/resources/regions.ts`.
- Tests live next to resources (e.g. `regions.test.ts`); `routing.ts` currently has **no**
  SDK-side test file — Success Criterion 6 requires adding one as new methods land.

## OSRM HTTP API shapes (confirmed against osrm-backend v5.27.1 `docs/http.md`)

- **`/table/v1/{profile}/{coords}?annotations=duration,distance&sources=..&destinations=..`** →
  `durations[i][j]` (s) and `distances[i][j]` (m), row-major; cells may be `null` (no route).
  `sources`/`destinations` accept index lists or `all`. Backs `/matrix`.
- **`/match/v1/{profile}/{coords}?timestamps=..&radiuses=..&gaps=split|ignore&tidy=..&geometries=geojson&overview=full`**
  → `matchings` (Route objects + `confidence` 0..1) and `tracepoints` (null for outliers, with
  `matchings_index`/`waypoint_index`). Error code `NoMatch`. Backs `/match`.
- **`/trip/v1/{profile}/{coords}?roundtrip=..&source=any|first&destination=any|last&geometries=geojson`**
  → TSP via greedy farthest-insertion (≥10 waypoints) / brute force (<10); `trips` + `waypoints`
  (each waypoint carries `waypoint_index` = visiting order). Not all
  roundtrip/source/destination combos are supported. Backs `/optimize` (OSRM-Trip option).
- **Profile is baked into the graph at `osrm-extract` time** (the Lua profile). A single
  `osrm-routed` instance serves exactly one profile. Multi-profile ⇒ multiple built graphs +
  multiple served instances (or multiple containers). This is the core infra change for SC #2.

## Decisions to make (OPEN — flag for human resolution)

| # | Question | Options | Lean / recommendation |
|---|----------|---------|-----------------------|
| D1 | **How to serve walking/cycling profiles?** OSRM bakes the profile into the graph; one `osrm-routed` = one profile. | (a) Build 3 graphs (car/bike/foot) and run 3 `osrm-routed` instances behind one Caddy, routed by path prefix → one base URL, profile in the OSRM path. (b) 3 separate deployments, 3 base URLs (`OSRM_DRIVING_BASE_URL` etc.). (c) Ship only car now; gate walking/cycling behind a feature flag until graphs are deployed. | **(a)** — keeps a single `OSRM_BASE_URL`/token, the Worker just varies the `{profile}` path segment. Caddy maps `/route/v1/foot/*`→foot instance, etc. Biggest infra task in the phase; build RAM ~+3–4 GB per profile to serve. Needs your sign-off on host sizing. |
| D2 | **`/optimize`: OSRM Trip vs VROOM sidecar?** | OSRM `/trip` = zero new infra, but only symmetric TSP (no time windows, capacities, multiple vehicles, or skills). VROOM = real VRP (windows/capacity/multi-vehicle) but a **new sidecar service** to deploy + operate, and it itself calls OSRM `/table`. | **RESOLVED 2026-06-12 (10-04 Task 1):** ship **OSRM `/trip` (TSP) for v1** — zero new infra. VROOM deferred to a fast-follow when a customer needs true VRP (time windows/capacities/multi-vehicle). |
| D3 | **Isochrone hull: `ST_ConcaveHull` vs `ST_ConvexHull` on Neon?** | `ST_ConcaveHull` (PostGIS 3.3+/GEOS 3.11+) gives realistic, "shrink-wrapped" reachability shapes; `ST_ConvexHull` always available but over-estimates reach (rubber-band). | **RESOLVED 2026-06-12 (10-02 Task 1):** probed live Neon — PostGIS **3.5.0**, **GEOS 3.11.1** → use **`ST_ConcaveHull(ST_Collect(pts), 0.3)`**. No ConvexHull fallback needed. |
| D4 | **Isochrone sampling strategy.** OSRM has no native isochrone. Approach: fan out destination points around the origin, call `/table` (origin → many bearings×radii sample points), keep points whose duration ≤ threshold, hull them. | Trade sample density vs OSRM `/table` cost. | Start with a fixed ring/grid (e.g. N bearings × M radius steps) capped to keep one `/table` call ≤ ~100 coords; make density a documented internal constant, not a public knob, for v1. |
| D5 | **Request method for multi-point endpoints.** Matrix/match/optimize take arrays of coordinates that can be large. | GET with delimited query string (consistent with existing GET-only public API + explorer allowlist) vs POST with JSON body (cleaner for large traces). | GET keeps parity with the current public surface and the explorer; but long GPS traces may blow the URL length. **Recommend POST (JSON body) for `/match` and `/optimize`; GET for `/matrix` if point counts stay modest, else POST.** Coercion gotcha (z.coerce) only applies to GET — POST bodies validate normally. Needs your call as it affects the explorer (non-GET = docs-only there). |

## Dependencies

- **No hard code dependency** on Phase 9 (SDK publish). New SDK methods land in the workspace
  source; they ship to npm whenever the next SDK version is published — that publish is Phase 9's
  job, not a blocker here.
- **Hard infra dependency for SC #2 (profiles):** foot/bike OSRM graphs must be built and served
  before the walking/cycling path can be verified end-to-end against real OSRM (D1).
- PostGIS `ST_ConcaveHull` capability on the live Neon instance (D3) gates the isochrone query
  shape.

## Infra changes required (summary)

1. **Multi-profile OSRM** (SC #2): extend `infra/osrm/build-graph.sh` to also build bike + foot
   graphs (`-p /opt/bicycle.lua`, `-p /opt/foot.lua`), run additional `osrm-routed` instances,
   and route them in `infra/osrm/Caddyfile` by path. Update `SELF-HOSTING.md`/`DEPLOY.md` sizing.
   (Planned as a dedicated plan; the API code can be written + unit-tested against mocked OSRM
   before the graphs are live, but SC #2 is only *verifiable* once deployed.)
2. **Env** (`packages/env/src/server.ts`): no change if D1=(a) single base URL; add per-profile
   URLs only if D1=(b). Add VROOM vars only if D2 chooses VROOM (deferred).

## Out of scope

- VROOM sidecar / true multi-vehicle VRP (deferred fast-follow; see D2).
- Time-windowed / capacitated optimisation, vehicle skills.
- Traffic-aware / time-dependent routing, alternatives ranking.
- Caching/precomputed matrices, tile service exposure.
- Python SDK (Phase 11).

## Key files

| File | Role in this phase |
|------|--------------------|
| `packages/api/src/shared/routing-queries.ts` | Generalise OSRM client: profile param + add `fetchOsrmTable`, `fetchOsrmMatch`, `fetchOsrmTrip`; keep `fetchOsrmRoute` working. |
| `packages/api/src/routers/public/routing.ts` | Add `routingMatrix`, `routingIsochrone`, `routingMatch`, `routingOptimize`; widen `directions` profile. |
| `packages/api/src/routers/public/routing.test.ts` | Extend with cases for each new endpoint (mocked OSRM). |
| `packages/api/src/shared/routing-queries.test.ts` | Unit-test each new OSRM client helper against mocked fetch. |
| `packages/api/src/shared/isochrone-queries.ts` (new) | PostGIS hull + optional ABS-region overlap for isochrones. |
| `packages/api/src/routers/public-http.ts` | Register the 4 new procedures under `routing:`. |
| `packages/env/src/server.ts` | Only if D1=(b)/D2=VROOM. |
| `packages/sdk/src/resources/routing.ts` | Add `matrix`, `isochrone`, `match`, `optimize` methods + types. |
| `packages/sdk/src/resources/routing.test.ts` (new) | SDK-side tests for the new methods (SC #6). |
| `infra/osrm/build-graph.sh`, `Caddyfile`, `SELF-HOSTING.md`, `DEPLOY.md` | Multi-profile deploy (SC #2). |
