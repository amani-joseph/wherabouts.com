# Dashboard UI — Geocoding & Geofencing — Program Design Spec

**Date:** 2026-06-04
**Status:** Approved — ready for per-phase planning
**Type:** Multi-phase program (6 phases). Each phase gets its own implementation plan.

Research briefs (per surface): `docs/superpowers/research/ui-{zones,webhooks,batch,devices,docs}.md`
Backend feature spec it builds on: `docs/superpowers/specs/2026-06-04-mapping-geocoding-geofencing-design.md`

---

## Goal

Add dashboard UIs to `apps/web` so users can manage and exercise the geocoding/geofencing
features that currently exist only as the public HTTP API: zones, webhooks, batch geocoding,
device tracking — plus document the new endpoints in the in-app docs/explorer.

## Locked decisions

1. **Data path:** dashboard calls **new session-authed oRPC procedures** on `appRouter`
   (`protectedProcedure`), NOT the public HTTP API. Procedures re-derive project ownership
   from `session.user.id`. Shared PostGIS/business logic is extracted so public and dashboard
   routers cannot drift.
2. **Project scoping:** an **active-project selector** in the dashboard. Every page filters to
   the selected project. Every procedure takes `{ projectId, ... }` and verifies
   `projects.userId === session.user.id`.
3. **Map stack:** **MapLibre GL JS + terra-draw** on **MapTiler free** vector tiles. A free
   MapTiler API key is provisioned by the project owner and wired via env. A shared,
   client-only (SSR-safe) `<MapCanvas>` component is reused by zones and devices.
4. **Backend gaps:** build all required + recommended — `devices.list`, `webhooks.reactivate`,
   `geocode.batchList`, and a migration making `batch_geocode_jobs.apiKeyId` nullable.
5. **History data:** add both `webhook_delivery_attempts` and `device_location_history` tables
   with write-paths in the queue consumer / location-push handler; UIs show delivery timeline
   and device trails.
6. **Docs/Explorer:** hand-author docs for the 16 new public endpoints; try-it stays GET-only
   (GET endpoints executable; POST/PUT/DELETE shown as curl examples).

---

## Phase breakdown & build order

```
Phase 0  Foundation ───────────────► (blocks all)
            │
            ▼
Phase 1  Zones Manager ─────────────► (defines map UX reused by P4)
            │
   ┌────────┼─────────────┬───────────────┐
   ▼        ▼             ▼               ▼
Phase 2   Phase 3       Phase 4         Phase 5
Webhooks  Batch         Devices         Docs/Explorer
(parallel after P0; P4 also needs P1; P2 zone-picker softly needs P1)
```

- **P0 → P1** sequential. **P2, P3, P5** may start once P0 lands. **P4** needs P0 + P1.
- Each phase = its own spec/plan + build; phases 2–5 execute in separate git worktrees.

---

## Phase 0 — Foundation (sequential, first)

**Deliverables**
- Install `maplibre-gl` + `terra-draw` (+ maplibre adapter). Add `VITE_MAPTILER_KEY` to
  `packages/env/src/web.ts` (client-safe) and document provisioning.
- `apps/web/src/components/map/map-canvas.tsx` — client-only `<MapCanvas>` (dynamic import /
  `useEffect`-mounted to avoid SSR), props for center/zoom, GeoJSON layers, optional draw mode,
  and `onDrawChange` callback. This is the single map dependency for P1 + P4.
- oRPC convention module + a shared `requireProjectOwnership(db, projectId, userId)` helper.
- Extract shared PostGIS query logic (zone CRUD/PIP/within, device upsert/crossings) into
  reusable functions callable by BOTH `publicHttpRouter` and the new `appRouter` domains, so
  logic can't drift. (Refactor existing public handlers to call the shared functions.)
- Active-project selector component + a small client store (or route search param) holding the
  selected `projectId`; sidebar nav entries + empty route files for Zones/Webhooks/Batch/Devices.

**Done when:** a placeholder protected route can render `<MapCanvas>` with a basemap, the
project selector switches active project, and a sample `protectedProcedure` enforces ownership.

---

## Phase 1 — Zones Manager

**oRPC (`appRouter.zones`):** `list`, `get`, `create`, `update`, `delete`, `contains`,
`addresses` — all `{ projectId, ... }`, ownership-verified, delegating to the shared zone
functions. Add a bulk `zones.list` variant returning geometry (GeoJSON) so the map renders all
zones in one call rather than N gets.

**UI (`/_protected/zones`):** `<MapCanvas>` with terra-draw polygon draw/edit; zone list panel;
create/edit/delete; point-in-polygon "test a coordinate" tool (drops a pin, calls `contains`);
"addresses in zone" viewer (paginated, 10k-truncation notice). Surface the 500-zone limit
(FORBIDDEN) and ST_IsValid / closed-ring errors inline.

---

## Phase 2 — Webhooks

**Data:** new `webhook_delivery_attempts` table (id, subscription_id FK, event, zone_id,
device_id, status_code, ok bool, attempt int, error, created_at). Queue consumer
(`apps/server/src/queues/webhook-delivery.ts`) writes a row per attempt.

**oRPC (`appRouter.webhooks`):** `list`, `create` (returns plaintext secret once), `delete`,
`reactivate` (clears `failing`), `deliveries` (recent attempts for a subscription). Add a public
+ shared `reactivate` path too.

**UI (`/_protected/webhooks`):** subscription table (url, events, zone/"all", active/failing
badge); create dialog (url, event checkboxes, optional zone picker via `zones.list` — falls back
to "all zones" if P1 not yet merged); once-only secret reveal w/ copy; reactivate a failing sub;
delivery timeline drawer from `deliveries`.

---

## Phase 3 — Batch Geocoding

**Migration:** `batch_geocode_jobs.apiKeyId` → nullable (dashboard submits have no API key).
Lift the per-row result type into `packages/sdk` (currently `unknown[]`).

**oRPC (`appRouter.geocode`):** `batchSubmit`, `batchPoll`, `batchResults`, `batchList`
(history for the project). Dashboard submits set `apiKeyId = null`.

**UI (`/_protected/batch`):** paste newline-separated addresses AND/OR CSV upload (client-side
parse, column pick if multi-column, ≤1000 + min-length validation); submit → job card with
react-query `refetchInterval` polling progress (processedCount/inputCount) until
completed/failed; results table (input → matched address+lat/lng or error) with CSV/JSON export;
recent-jobs list from `batchList`.

---

## Phase 4 — Device Tracking (needs P0 + P1)

**Data:** new `device_location_history` table (project_id, device_id, lat, lng, zone_ids[],
created_at) — append on each location push for trails. Push handler
(`packages/api/src/routers/public/devices.ts` shared fn) writes a history row.

**oRPC (`appRouter.devices`):** `list` (NEW — query `device_zone_state` by project), `get`
(current state + zones), `history` (recent positions for a device), `pushLocation` (manual
"simulate location" tester, reuses shared push logic). `list` is required — no list endpoint
exists today.

**UI (`/_protected/devices`):** device list (id, last seen, # current zones); `<MapCanvas>`
(reused) with device markers + their containing-zone overlays (zones rendered via `zones.list`);
click device → current zones + trail from `history`; "simulate a location push" tool to demo
entry/exit + live webhook firing. Note: stale-device handling + auto-refresh interval are UI
config (default 15s poll while page focused).

---

## Phase 5 — Docs / Explorer

Hand-author entries for all **16 new public endpoints** across the four existing layers:
`docs-page.tsx` (`endpointDocs` + nav anchors + curl/JS examples + params + example responses),
`api-explorer-endpoints.ts` catalog, the explorer proxy `api-explorer.tsx` (GET-only — new GET
endpoints executable; POST/PUT/DELETE rendered as curl examples, not run), and `openapi.ts`
(hand-maintained spec). Add async-lifecycle narrative for batch (submit→poll→results) and
webhook delivery/HMAC semantics. No proxy changes (GET-only confirmed).

---

## Cross-cutting: file ownership (keeps parallel phases conflict-free)

- Each feature phase owns: its route file `apps/web/src/routes/_protected/<x>.tsx`, its
  components dir `apps/web/src/components/<x>/`, its oRPC domain file
  `packages/api/src/routers/domains/<x>.ts`, and its migration(s).
- **Shared touch-points** (edited by P0, then append-only by later phases to minimize conflicts):
  `appRouter` index (`packages/api/src/routers/index.ts`), sidebar nav, `packages/sdk` types.
  Phases append their own keys/types; merges are line-additive.

## Testing

- oRPC procedures: ownership-enforcement tests (wrong-user → denied), input validation, and the
  shared PostGIS functions' unit tests (reuse/extend existing patterns).
- Pure UI logic (CSV parse, GeoJSON polygon validation, boundary-crossing display, polling state)
  extracted into pure modules + vitest, mirroring the backend phase's `*-schema.ts` split.
- Map components are client-only; smoke-test render + draw-callback wiring.

## Out of scope (v1)

- Real-time push (WebSocket) for device positions — polling only.
- Executable POST/PUT/DELETE in the explorer try-it.
- Auto-generated OpenAPI from the router (stays hand-maintained this iteration).
- Billing/usage UI changes for the new endpoints (existing analytics page unchanged).
