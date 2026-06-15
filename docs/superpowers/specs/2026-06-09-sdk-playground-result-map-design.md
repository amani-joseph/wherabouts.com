# SDK Playground — result map visualization

**Date:** 2026-06-09
**Status:** Approved (design)
**Area:** `apps/web` (SDK Playground)
**Builds on:** `2026-06-09-sdk-playground-key-select-geocode-design.md` (same branch family)

## Summary

Add a full-width map panel below the SDK Playground's existing two-column row that
visualizes what the selected SDK method operates on. The map shows **both** live
inputs (markers/radius as the user fills the form) and the **result** geometry
(route lines, points, polygons) after Run. The map is **read-only**. Methods with
no geographic meaning render a small empty-state instead.

## Decisions (resolved with user)

| Question | Decision |
|---|---|
| Method scope | All geo-capable methods: routing, geocode/autocomplete, reverse, nearby, zones |
| Inputs vs outputs | Both — live input markers + result geometry after Run |
| Layout | Full-width card below the Method / SDK-code row |
| Interactivity | Read-only (no click-to-set) |

## Architecture

The map component stays "dumb": it renders a neutral **`MapScene`** (a list of
features). Two pure, unit-testable builder functions translate playground state
into a scene — one for form inputs, one for the API result. This keeps all
method-specific knowledge out of the MapLibre rendering code and out of React
effects.

### Neutral feature model

```ts
export type MapFeature =
  | { kind: "marker"; lngLat: [number, number]; label: string; role: MarkerRole }
  | { kind: "line"; coordinates: [number, number][] }
  | { kind: "circle"; center: [number, number]; radiusM: number }
  | { kind: "polygon"; rings: [number, number][][] };

export type MarkerRole = "from" | "to" | "point" | "center" | "result";

export interface MapScene {
  features: MapFeature[];
}
```

All coordinates are MapLibre order **`[lng, lat]`**. Route `geometry.coordinates`
are already `[lng, lat]`; zone polygon rings are already `[lng, lat]`; form
`"lat,lng"` strings and separate `lat`/`lng` params are swapped to `[lng, lat]` by
the builders.

### Pure builders

`apps/web/src/components/sdk-playground/scene-builders.ts`

```ts
sceneFromInputs(endpointId: string, paramValues: Record<string, string>): MapScene
sceneFromResult(endpointId: string, result: unknown): MapScene
```

- **`sceneFromInputs`** reads the form:
  - `routing.directions`: parse `from`/`to` as `"lat,lng"` → two markers (roles
    `from`/`to`). Skip a field that isn't a valid coordinate (e.g. a place name not
    yet resolved).
  - `addresses.nearby`: parse `lat`+`lng` → center marker; if `radius` is numeric →
    a `circle` of `radiusM`.
  - `addresses.reverse`: parse `lat`+`lng` → a `point` marker.
  - everything else → empty scene.
- **`sceneFromResult`** reads the response JSON defensively (it is `unknown`; guard
  every field):
  - `routing.directions`: `result.geometry.coordinates` → `line`; `result.query.from`
    / `result.query.to` (`{lat,lng}`) → `from`/`to` markers.
  - `addresses.geocode`: `result.address.{latitude,longitude}` → `result` marker.
  - `addresses.reverse`: `result.address.{latitude,longitude}` → `result` marker.
  - `addresses.autocomplete` / `addresses.nearby`: `result.results[]` each with
    `{latitude,longitude}` → `result` markers.
  - `addresses.byId`: `result.{latitude,longitude}` → `result` marker.
  - `zones.get`: `result.geometry` (GeoJSON Polygon) → `polygon`.
  - `zones.list`: `result.zones[].geometry` → one `polygon` per zone.
  - unknown shape / no coords → empty scene.

A combined scene is `{ features: [...inputScene.features, ...resultScene.features] }`.
Input markers render at reduced opacity; result features render solid (the
component decides styling from `role`, not the builder).

### Component

`apps/web/src/components/sdk-playground/sdk-result-map.tsx` — **`SdkResultMap`**

```ts
interface SdkResultMapProps {
  scene: MapScene;
}
```

- Wraps the existing `MapCanvas` (`apps/web/src/components/map/map-canvas.tsx`),
  which lazy-loads MapLibre with the Protomaps basemap.
- On `onMapReady`, stores the map instance; an effect syncs the current `scene` to
  GeoJSON sources/layers (markers via `Marker`, lines/polygons/circles via sources +
  layers), clearing previous features first. Circle is approximated as a GeoJSON
  polygon ring (≈64 segments) so it uses the same fill layer machinery.
- Auto-`fitBounds` to the union of all feature coordinates when the scene is
  non-empty (mirrors the bounds logic in `zones/zone-map.tsx`), with a sensible
  `maxZoom` and padding; single-point scenes use `flyTo`/`jumpTo` at a fixed zoom.
- **Empty state:** when `scene.features.length === 0`, render a centered muted
  message ("This method has no map view.") instead of the map, so non-geo methods
  (`webhooks.*`, `devices.*`, batch jobs) don't show a blank world map.

### Playground wiring

`apps/web/src/components/sdk-playground.tsx`

- Derive `inputScene = useMemo(() => sceneFromInputs(endpoint.id, paramValues), …)`.
- Hold `resultScene` in state; set it in `run()` on success by parsing the same
  object used for `setResult`, and clear it when the method changes.
- `const scene = { features: [...inputScene.features, ...resultScene.features] }`.
- Render `<SdkResultMap scene={scene} />` inside a full-width `Card` placed **after**
  the existing `grid lg:grid-cols-2` row.

## Data flow

1. User selects `routing.directions`, picks `from`/`to` via the LocationInput picker
   → `paramValues` hold `"lat,lng"` strings → `sceneFromInputs` yields two faint
   markers → map shows them and fits bounds.
2. Run succeeds → response parsed → `sceneFromResult` yields the route line + solid
   endpoints → map redraws and refits to include the whole route.
3. User switches to `webhooks.create` → both scenes empty → empty-state message.

## Edge cases

- **Place name not yet resolved** (form holds "Brisbane", not coords) → that marker
  is skipped; no crash.
- **Malformed / partial result JSON** → builders guard each field and return an
  empty scene rather than throwing.
- **Result error body** (`{ error: { … } }`) → no coordinate fields → empty result
  scene; input markers still show.
- **Single point** → `fitBounds` of one point is degenerate; use fixed-zoom center
  instead.
- **Non-geo method** → empty-state, not a blank map.
- **SSR** → `MapCanvas` already guards `typeof window`; `SdkResultMap` adds no
  server-only work.
- **Scene churn** → the sync effect clears prior sources/markers before adding new
  ones to avoid leaks/duplicates on every keystroke.

## Testing

- **Unit (`scene-builders.test.ts`)** — the bulk of coverage, no MapLibre needed:
  - `sceneFromInputs` for routing (two markers), nearby (center + circle), reverse
    (point); skips non-coordinate fields; empty for non-geo ids.
  - `sceneFromResult` for routing (line + endpoints from `query`), geocode/reverse
    (point), autocomplete/nearby (N markers), zones.get/list (polygons), byId
    (point); empty for error bodies and unknown shapes.
  - Coordinate order: assert `[lng, lat]` output from `"lat,lng"` input.
- **Component** — light render test that `SdkResultMap` shows the empty-state for an
  empty scene (MapLibre is dynamically imported and not exercised in jsdom).

## Out of scope (YAGNI)

- Click-to-set inputs (explicitly read-only this round).
- Boundary-crossing / region polygons beyond `zones.*`.
- Animating the route or step-by-step direction markers.
- Persisting map view state across method switches.
