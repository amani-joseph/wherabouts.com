# Design-Research Brief: Device Tracking Dashboard

Dashboard surface for pushing device locations, viewing positions on a map, and
inspecting current zone membership. Read-only research; no source changes made.

## Endpoints / Data

### Shipped public API (API-key-authed, `packages/api/src/routers/public/`)

These are the existing `apiKeyAuth` + `usageMiddleware` procedures. They are
designed for SDK/customer-server consumers, NOT the session-authed dashboard.

**`pushDeviceLocation`** — `devices.ts`
- Route: `POST /api/v1/devices/{deviceId}/location`
- Input: `{ deviceId: string(1..255), lat: number(-90..90), lng: number(-180..180) }`
- Behavior:
  1. Computes containing zones via PostGIS `ST_Contains(zones.geom, point)` for the project.
  2. In a transaction, `SELECT ... FOR UPDATE` locks the device row (TOCTOU-safe),
     reads previous `zone_ids`, computes crossings, upserts `device_zone_state`.
  3. After commit, enqueues one webhook-delivery message per crossing to
     `WEBHOOK_DELIVERY_QUEUE` (entry/exit events).
- Returns: `{ zones: number[], crossings: BoundaryCrossing[] }`
  (`DeviceLocationResponse` in SDK types).

**`getDeviceZones`** — `devices.ts`
- Route: `GET /api/v1/devices/{deviceId}/zones`
- Input: `{ deviceId: string }`
- Returns: `{ deviceId, zoneIds, latitude, longitude, updatedAt }`
  (`DeviceZonesResponse`). Throws `NOT_FOUND` if no state row exists.

**`computeBoundaryCrossings`** — `boundary-crossings.ts` (pure, unit-tested)
- Signature: `(previousZoneIds, currentZoneIds, zoneNames) => BoundaryCrossing[]`
- `BoundaryCrossing = { zoneId: number, zoneName: string, event: "entry" | "exit" }`
- Semantics: in `curr` but not `prev` => **entry**; in `prev` but not `curr` => **exit**.
  Stays-in and stays-out produce no crossing. Zone names are resolved from a
  UNION of prev+curr ids so exit events still get real names.

### Schema: `device_zone_state` (`packages/database/src/schema/zones.ts`)
```
project_id  uuid     FK projects(id) ON DELETE CASCADE
device_id   varchar(255)
zone_ids    integer[] NOT NULL DEFAULT '{}'
latitude    double precision NOT NULL
longitude   double precision NOT NULL
updated_at  timestamptz NOT NULL DEFAULT now()
PRIMARY KEY (project_id, device_id)
```
Plus `zones` table: `id` (identity int PK), `project_id`, `name varchar(255)`,
`description`, `geom geometry(Polygon,4326)` (GiST index), `metadata`, timestamps.

**Key data facts:**
- `device_zone_state` holds only the **last-known** position + current zone set per
  device. There is **no location-history table** — past positions are overwritten on
  every push. Any "trail" or history view is impossible without a new table.
- A device "exists" only once it has pushed at least one location (a row appears on
  first push). There is no separate device-registration concept.

## oRPC procedures to add (session-authed `appRouter`)

**Decision A is settled:** the dashboard talks to session-authed `protectedProcedure`
procedures in `appRouter` (`packages/api/src/routers/index.ts`), NOT the API-key
public procedures. Add a new `devicesRouter` domain
(`packages/api/src/routers/domains/devices.ts`) and register it as
`devices: devicesRouter` in `appRouter`.

Build with `protectedProcedure` from `procedures.ts` (it injects `context.session`).
Scope every query by the user's selected/owned project (resolve project via the
existing project-ownership pattern used in `dashboard`/`projects` routers — devices
are keyed by `project_id`, not `user_id`, so a project-ownership check is required).

### REQUIRED NEW: `devices.list`
- **There is NO "list all devices for a project" endpoint anywhere today** — only
  get-one-by-id (`getDeviceZones`). The dashboard list view cannot be built without it.
- Implementation: query `device_zone_state` filtered by `project_id`, ordered by
  `updated_at DESC`.
- Suggested input: `{ projectId: string }` (+ optional pagination `limit`/`cursor`,
  optional `staleBefore` filter — see Open Questions).
- Suggested output per row:
  `{ deviceId, latitude, longitude, zoneIds: number[], zoneCount: number, updatedAt }`.
  Consider joining `zones.name` so the list/map can show zone names without N calls
  (single `inArray` lookup over the union of all returned `zone_ids`).

### `devices.get`
- Session-authed equivalent of `getDeviceZones` for the detail panel.
- Input `{ projectId, deviceId }`; returns the single `device_zone_state` row plus
  resolved zone names. Throws `NOT_FOUND` when absent.

### `devices.pushLocation` (optional — "simulate location" tester)
- Session-authed wrapper that reuses the same logic as the public
  `pushDeviceLocation` (extract the core into a shared helper so the PostGIS query,
  crossing computation, upsert, and webhook enqueue are not duplicated).
- Lets a dashboard user drop a point and watch entry/exit crossings + webhooks fire
  live. Returns `{ zones, crossings }` so the UI can surface the crossing toast.
- Gate behind the in-scope decision (Open Questions).

## Map reuse

Device positions plot on the **shared `<MapCanvas>` component established by the
Zones phase (Phase 1)**. This brief **assumes that component exists** and does NOT
re-pick a map library — defer entirely to the zones research for the base map,
projection, zone-polygon rendering, and library choice.

Devices layer on top of `<MapCanvas>` as follows:
- **Zone polygons** render as the base layer (already provided by the zones map).
- **Device markers**: one marker per `device_zone_state` row at `(longitude, latitude)`.
  Label/tooltip with `deviceId` + last-seen time.
- **Containing-zone highlight**: when a device is selected (or hovered), highlight the
  polygon(s) in its `zone_ids` set so the user sees which zone(s) contain it. The
  client already has `zone_ids` per device from `devices.list`, so highlighting is a
  pure client-side style toggle — no extra fetch.
- **Stale styling**: dim/desaturate markers whose `updated_at` is older than a
  threshold (see Open Questions).
- The map should accept the device array as props and expose a selected-device id so
  the list and detail panel stay in sync with map selection.

## Components needed

- `routes/_protected/devices.tsx` — route + page shell (mirror `api-keys.tsx`
  structure: header + description, content card, loading skeleton, empty state).
- `DeviceList` — table/list of devices: `deviceId`, last-seen (`timeAgo(updatedAt)`,
  reuse the `timeAgo` helper pattern from `api-keys.tsx`), and **# zones currently in**
  (`zoneIds.length`). Row click selects the device.
- `DeviceMap` — thin wrapper around shared `<MapCanvas>` that takes the device list +
  selected id and renders markers + zone highlights.
- `DeviceDetailPanel` — shows the selected device's current zones (names + ids),
  exact lat/lng, and last-seen timestamp.
- `SimulateLocationDialog` (optional) — lat/lng inputs (or click-to-place on the map),
  calls `devices.pushLocation`, surfaces returned `crossings` as entry/exit toasts.
- Loading skeleton + empty state ("No devices yet — push a location to see it here").

Data layer: use `orpcClient` / `orpc` TanStack-Query utils from
`apps/web/src/lib/orpc.ts`. `api-keys.tsx` currently uses imperative
`useEffect` + `orpcClient.x.list()`; prefer the `orpc` query utils for the device
list so auto-refresh (polling) is trivial via `refetchInterval`.

## UX flow

1. User opens **Devices** under a selected project.
2. `devices.list` loads → split view: device list (left) + map (right).
3. List shows id, last-seen, # zones-in. Map shows all device markers over zone polygons.
4. Selecting a device (in list or on map) opens the detail panel, centers/zooms the
   marker, and highlights its containing zone(s).
5. Optional: user opens "Simulate location push", places/enters a point, submits →
   `devices.pushLocation` runs → entry/exit crossings shown as toasts, the device's
   marker + zone membership update, and real webhooks fire (good live demo of the
   whole pipeline).
6. Live positions auto-refresh on an interval (see Open Questions).

## Edge cases

- **Empty project**: no `device_zone_state` rows → empty state, map shows only zones.
- **Device with zero zones**: `zone_ids = '{}'` → marker with "0 zones", no highlight.
- **Stale devices**: a device may have pushed days ago; `updated_at` is the only
  freshness signal. Need a visual stale treatment and possibly a filter.
- **Deleted/renamed zones**: a device's `zone_ids` could reference a zone that was
  later deleted; the name join may return fewer rows than ids — render id-only fallback.
- **Project deletion cascades** device rows (FK ON DELETE CASCADE) — list just empties.
- **Marker overlap**: many devices at the same coordinates (e.g. a fleet at a depot)
  need clustering or jitter — defer detail to the zones map capabilities.
- **No history**: clicking a device shows only the current point; no trail/path is
  available unless a history table is added.
- **Simulate-push side effects**: a dashboard simulation fires REAL webhooks and
  mutates real device state. Must be clearly labeled and ideally project-scoped to
  test data only.

## Open questions (human decisions)

1. **Auto-refresh interval** for live positions — fixed `refetchInterval` (e.g. 5s/10s/30s),
   manual refresh only, or real-time (would require new SSE/WebSocket infra not present today)?
2. **Stale devices** — do we hide devices older than N hours/days, show them dimmed,
   or always show all? What threshold counts as "stale"? Should `devices.list` take a
   `staleBefore`/`activeOnly` filter or should the client do it?
3. **Is the "simulate a location push" tool in scope** for v1? It's a strong live demo
   of entry/exit + webhooks, but it mutates real device state and fires real webhooks.
   If yes, do we need a safety guard (test-only project, confirmation, dry-run mode)?
4. **Location history** — currently impossible (only last-known position is stored).
   Do we need device trails/history? If yes, that requires a NEW append-only
   `device_location_history` table + writes on every push (storage + write-cost
   implications) — a backend/data decision, not just UI.

## Source references

- `packages/api/src/routers/public/devices.ts` — pushDeviceLocation, getDeviceZones
- `packages/api/src/routers/public/boundary-crossings.ts` — computeBoundaryCrossings, entry/exit
- `packages/database/src/schema/zones.ts` — `device_zone_state` + `zones` schema
- `packages/sdk/src/types.ts` — DeviceLocationResponse, DeviceZonesResponse
- `packages/api/src/routers/index.ts` — `appRouter` composition (add `devices`)
- `packages/api/src/procedures.ts` — `protectedProcedure` (session auth)
- `packages/api/src/routers/domains/dashboard.ts` — session-authed project-scoped query pattern
- `apps/web/src/routes/_protected/api-keys.tsx` — route/list/skeleton/timeAgo conventions
- `apps/web/src/lib/orpc.ts` — `orpcClient` + `orpc` TanStack-Query utils
