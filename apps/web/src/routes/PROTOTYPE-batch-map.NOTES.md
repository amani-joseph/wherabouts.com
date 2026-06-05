# PROTOTYPE: mapcn batch-results cluster map — NOTES

**Question:** Does mapcn (MapLibre + Tailwind, vendored via `npx shadcn add @mapcn/map`)
look and feel good for rendering batch-geocode results against our real AU data?

**Branch:** `prototype/batch-cluster-map` · **Route:** `/prototype/batch-map?variant=A|B|C`
(arrow keys cycle; switcher hidden in prod builds). Dev server during this run: http://localhost:3004

**Data:** real GNAF coordinates sampled from the `addresses` table (16.8M rows) via the
throwaway route `/api/prototype-batch-points` (TABLESAMPLE SYSTEM, ~5000 pts).

## Variants
- **A — Clusters (full-bleed):** `MapClusterLayer` + `MapPopup` + `MapControls`. The headline.
- **B — Heatmap density:** raw MapLibre `heatmap` layer added via the `useMap()` hook.
- **C — Split map + results list:** clusters on the map, scrollable real-address list; row click `flyTo`.

## Verdict (✅ proceed)
All three render correctly against 5k real points with the dark CARTO basemap matching our
theme out of the box. Clustering (A) and heatmap (B) are both strong; A is the recommended
default for the batch results page, B is a nice toggle. Integration cost was low — one shadcn
command + a data route.

## Productionizing notes (fix when folding in, NOT prototype blockers)
1. **SSR hydration warning:** mapcn's `map.tsx` does `import "maplibre-gl/dist/maplibre-gl.css"`
   inside a client component → React SSR warns `<link> cannot be a child of <html>`. Fix: import
   the maplibre CSS once globally (packages/ui globals.css) and remove it from the component.
2. **CARTO glyphs CORS:** the CARTO font endpoint intermittently 403s on CORS (labels still
   rendered). For production pick a glyphs source we control — OpenFreeMap or MapTiler — or
   self-host; also lets us tune the AU basemap.
3. **Real wiring:** swap the sampled-addresses route for the actual batch job's results
   (R2/GeoJSON) keyed by jobId, with project-ownership auth (this prototype route is public).
4. Vendored file lives in the shared UI package: `packages/ui/src/components/ui/map.tsx`.

## Cleanup when done
Delete: this NOTES file, `routes/prototype.batch-map.tsx`, `routes/api/prototype-batch-points.ts`.
Keep `packages/ui/.../map.tsx` only if adopting; otherwise `git checkout master -- ...` it away.
