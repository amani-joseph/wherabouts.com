# SDK Playground result map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only, full-width map panel to the SDK Playground that visualizes both live form inputs and API result geometry for all geo-capable methods.

**Architecture:** A neutral `MapScene` feature model decouples rendering from method knowledge. Two pure builders (`sceneFromInputs`, `sceneFromResult`) translate playground state into a scene and carry the bulk of the test coverage. `SdkResultMap` wraps the existing `MapCanvas` (Protomaps basemap), syncs the scene to MapLibre sources/markers, fits bounds, and shows an empty-state for non-geo methods.

**Tech Stack:** TanStack Start (React 19), MapLibre GL (lazy-loaded via `MapCanvas`), Vitest + Testing Library. Tabs + double quotes (Ultracite/Biome).

**Spec:** `docs/superpowers/specs/2026-06-09-sdk-playground-result-map-design.md`

---

## File Structure

- Create `apps/web/src/components/sdk-playground/map-scene.ts` — `MapFeature`/`MapScene`/`MarkerRole` types + small coord helpers.
- Create `apps/web/src/components/sdk-playground/scene-builders.ts` — `sceneFromInputs`, `sceneFromResult`.
- Create `apps/web/src/components/sdk-playground/scene-builders.test.ts` — the bulk of coverage.
- Create `apps/web/src/components/sdk-playground/sdk-result-map.tsx` — `SdkResultMap` component.
- Create `apps/web/src/components/sdk-playground/sdk-result-map.test.tsx` — empty-state render test.
- Modify `apps/web/src/components/sdk-playground.tsx` — derive scenes, render the map card.

---

## Task 1: Scene types + coord helpers

**Files:**
- Create: `apps/web/src/components/sdk-playground/map-scene.ts`

- [ ] **Step 1: Implement the types and helpers**

Create `apps/web/src/components/sdk-playground/map-scene.ts`:

```ts
export type MarkerRole = "from" | "to" | "point" | "center" | "result";

export type MapFeature =
	| { kind: "marker"; lngLat: [number, number]; label: string; role: MarkerRole }
	| { kind: "line"; coordinates: [number, number][] }
	| { kind: "circle"; center: [number, number]; radiusM: number }
	| { kind: "polygon"; rings: [number, number][][] };

export interface MapScene {
	features: MapFeature[];
}

export const EMPTY_SCENE: MapScene = { features: [] };

/** Parse a `"lat,lng"` string into MapLibre `[lng, lat]`. Returns null if invalid. */
export function lngLatFromLatLngString(raw: string): [number, number] | null {
	const parts = raw.split(",");
	if (parts.length !== 2) {
		return null;
	}
	const lat = Number(parts[0]);
	const lng = Number(parts[1]);
	if (!(Number.isFinite(lat) && Number.isFinite(lng))) {
		return null;
	}
	if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
		return null;
	}
	return [lng, lat];
}

/** Build `[lng, lat]` from separate numeric strings. Returns null if invalid. */
export function lngLatFromParts(
	latRaw: string | undefined,
	lngRaw: string | undefined
): [number, number] | null {
	if (latRaw === undefined || lngRaw === undefined) {
		return null;
	}
	return lngLatFromLatLngString(`${latRaw},${lngRaw}`);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web check-types`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/sdk-playground/map-scene.ts
git commit -m "feat(web): MapScene feature model + coord helpers for playground map"
```

---

## Task 2: `sceneFromInputs` builder (TDD)

**Files:**
- Create: `apps/web/src/components/sdk-playground/scene-builders.ts`
- Test: `apps/web/src/components/sdk-playground/scene-builders.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/sdk-playground/scene-builders.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sceneFromInputs } from "./scene-builders.ts";

describe("sceneFromInputs", () => {
	it("routing.directions: two markers in [lng,lat] order", () => {
		const scene = sceneFromInputs("routing.directions", {
			from: "-27.47,153.02",
			to: "-33.87,151.21",
		});
		expect(scene.features).toEqual([
			{ kind: "marker", lngLat: [153.02, -27.47], label: "from", role: "from" },
			{ kind: "marker", lngLat: [151.21, -33.87], label: "to", role: "to" },
		]);
	});

	it("routing.directions: skips a field that is not a coordinate", () => {
		const scene = sceneFromInputs("routing.directions", {
			from: "Brisbane",
			to: "-33.87,151.21",
		});
		expect(scene.features).toEqual([
			{ kind: "marker", lngLat: [151.21, -33.87], label: "to", role: "to" },
		]);
	});

	it("addresses.nearby: center marker + radius circle", () => {
		const scene = sceneFromInputs("addresses.nearby", {
			lat: "-37.81",
			lng: "144.96",
			radius: "500",
		});
		expect(scene.features).toEqual([
			{ kind: "marker", lngLat: [144.96, -37.81], label: "center", role: "center" },
			{ kind: "circle", center: [144.96, -37.81], radiusM: 500 },
		]);
	});

	it("addresses.reverse: single point marker", () => {
		const scene = sceneFromInputs("addresses.reverse", {
			lat: "-37.81",
			lng: "144.96",
		});
		expect(scene.features).toEqual([
			{ kind: "marker", lngLat: [144.96, -37.81], label: "point", role: "point" },
		]);
	});

	it("non-geo method: empty scene", () => {
		expect(sceneFromInputs("webhooks.create", {}).features).toEqual([]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web test -- scene-builders.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `sceneFromInputs`**

Create `apps/web/src/components/sdk-playground/scene-builders.ts`:

```ts
import {
	EMPTY_SCENE,
	lngLatFromLatLngString,
	lngLatFromParts,
	type MapFeature,
	type MapScene,
} from "./map-scene.ts";

export function sceneFromInputs(
	endpointId: string,
	paramValues: Record<string, string>
): MapScene {
	const features: MapFeature[] = [];

	if (endpointId === "routing.directions") {
		const from = lngLatFromLatLngString(paramValues.from ?? "");
		if (from) {
			features.push({ kind: "marker", lngLat: from, label: "from", role: "from" });
		}
		const to = lngLatFromLatLngString(paramValues.to ?? "");
		if (to) {
			features.push({ kind: "marker", lngLat: to, label: "to", role: "to" });
		}
		return { features };
	}

	if (endpointId === "addresses.nearby") {
		const center = lngLatFromParts(paramValues.lat, paramValues.lng);
		if (center) {
			features.push({
				kind: "marker",
				lngLat: center,
				label: "center",
				role: "center",
			});
			const radiusM = Number(paramValues.radius);
			if (Number.isFinite(radiusM) && radiusM > 0) {
				features.push({ kind: "circle", center, radiusM });
			}
		}
		return { features };
	}

	if (endpointId === "addresses.reverse") {
		const point = lngLatFromParts(paramValues.lat, paramValues.lng);
		if (point) {
			features.push({ kind: "marker", lngLat: point, label: "point", role: "point" });
		}
		return { features };
	}

	return EMPTY_SCENE;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web test -- scene-builders.test.ts`
Expected: PASS (all five cases).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/sdk-playground/scene-builders.ts apps/web/src/components/sdk-playground/scene-builders.test.ts
git commit -m "feat(web): sceneFromInputs builder for the playground map"
```

---

## Task 3: `sceneFromResult` builder (TDD)

**Files:**
- Modify: `apps/web/src/components/sdk-playground/scene-builders.ts`
- Modify: `apps/web/src/components/sdk-playground/scene-builders.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `apps/web/src/components/sdk-playground/scene-builders.test.ts`:

```ts
import { sceneFromResult } from "./scene-builders.ts";

describe("sceneFromResult", () => {
	it("routing.directions: line + from/to markers from query", () => {
		const scene = sceneFromResult("routing.directions", {
			query: { from: { lat: -27.47, lng: 153.02 }, to: { lat: -33.87, lng: 151.21 } },
			geometry: { type: "LineString", coordinates: [[153.02, -27.47], [151.21, -33.87]] },
		});
		expect(scene.features).toEqual([
			{ kind: "line", coordinates: [[153.02, -27.47], [151.21, -33.87]] },
			{ kind: "marker", lngLat: [153.02, -27.47], label: "from", role: "from" },
			{ kind: "marker", lngLat: [151.21, -33.87], label: "to", role: "to" },
		]);
	});

	it("addresses.geocode: single result marker", () => {
		const scene = sceneFromResult("addresses.geocode", {
			address: { latitude: -37.81, longitude: 144.96 },
		});
		expect(scene.features).toEqual([
			{ kind: "marker", lngLat: [144.96, -37.81], label: "result", role: "result" },
		]);
	});

	it("addresses.nearby: one marker per result", () => {
		const scene = sceneFromResult("addresses.nearby", {
			results: [
				{ latitude: -37.81, longitude: 144.96 },
				{ latitude: -37.82, longitude: 144.97 },
			],
		});
		expect(scene.features).toHaveLength(2);
		expect(scene.features[0]).toEqual({
			kind: "marker",
			lngLat: [144.96, -37.81],
			label: "result",
			role: "result",
		});
	});

	it("zones.list: one polygon per zone", () => {
		const scene = sceneFromResult("zones.list", {
			zones: [
				{ geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
			],
		});
		expect(scene.features).toEqual([
			{ kind: "polygon", rings: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
		]);
	});

	it("error body: empty scene", () => {
		const scene = sceneFromResult("addresses.geocode", {
			error: { code: "not_found", message: "No address" },
		});
		expect(scene.features).toEqual([]);
	});

	it("unknown shape: empty scene", () => {
		expect(sceneFromResult("addresses.geocode", null).features).toEqual([]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web test -- scene-builders.test.ts`
Expected: FAIL — `sceneFromResult` not exported.

- [ ] **Step 3: Implement `sceneFromResult`**

Append to `apps/web/src/components/sdk-playground/scene-builders.ts`:

```ts
// --- result parsing helpers (defensive: input is unknown) -----------------

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: null;
}

function markerFromLatLngFields(value: unknown, role: "result"): MapFeature | null {
	const rec = asRecord(value);
	if (!rec) {
		return null;
	}
	const lat = rec.latitude;
	const lng = rec.longitude;
	if (typeof lat === "number" && typeof lng === "number") {
		return { kind: "marker", lngLat: [lng, lat], label: role, role };
	}
	return null;
}

function markerFromLatLngObject(
	value: unknown,
	label: "from" | "to"
): MapFeature | null {
	const rec = asRecord(value);
	if (!rec) {
		return null;
	}
	const lat = rec.lat;
	const lng = rec.lng;
	if (typeof lat === "number" && typeof lng === "number") {
		return { kind: "marker", lngLat: [lng, lat], label, role: label };
	}
	return null;
}

function isLngLatArray(value: unknown): value is [number, number] {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		typeof value[0] === "number" &&
		typeof value[1] === "number"
	);
}

function polygonFromGeometry(value: unknown): MapFeature | null {
	const rec = asRecord(value);
	if (!rec || rec.type !== "Polygon" || !Array.isArray(rec.coordinates)) {
		return null;
	}
	const rings: [number, number][][] = [];
	for (const ring of rec.coordinates) {
		if (!Array.isArray(ring)) {
			return null;
		}
		const points = ring.filter(isLngLatArray);
		if (points.length > 0) {
			rings.push(points);
		}
	}
	return rings.length > 0 ? { kind: "polygon", rings } : null;
}

export function sceneFromResult(endpointId: string, result: unknown): MapScene {
	const rec = asRecord(result);
	if (!rec) {
		return EMPTY_SCENE;
	}
	const features: MapFeature[] = [];

	if (endpointId === "routing.directions") {
		const geometry = asRecord(rec.geometry);
		if (geometry && Array.isArray(geometry.coordinates)) {
			const coords = geometry.coordinates.filter(isLngLatArray);
			if (coords.length > 0) {
				features.push({ kind: "line", coordinates: coords });
			}
		}
		const query = asRecord(rec.query);
		if (query) {
			const from = markerFromLatLngObject(query.from, "from");
			if (from) {
				features.push(from);
			}
			const to = markerFromLatLngObject(query.to, "to");
			if (to) {
				features.push(to);
			}
		}
		return { features };
	}

	if (endpointId === "addresses.geocode" || endpointId === "addresses.reverse") {
		const marker = markerFromLatLngFields(rec.address, "result");
		if (marker) {
			features.push(marker);
		}
		return { features };
	}

	if (endpointId === "addresses.byId") {
		const marker = markerFromLatLngFields(rec, "result");
		if (marker) {
			features.push(marker);
		}
		return { features };
	}

	if (
		endpointId === "addresses.autocomplete" ||
		endpointId === "addresses.nearby"
	) {
		if (Array.isArray(rec.results)) {
			for (const row of rec.results) {
				const marker = markerFromLatLngFields(row, "result");
				if (marker) {
					features.push(marker);
				}
			}
		}
		return { features };
	}

	if (endpointId === "zones.get") {
		const polygon = polygonFromGeometry(rec.geometry);
		if (polygon) {
			features.push(polygon);
		}
		return { features };
	}

	if (endpointId === "zones.list") {
		if (Array.isArray(rec.zones)) {
			for (const zone of rec.zones) {
				const zoneRec = asRecord(zone);
				const polygon = zoneRec ? polygonFromGeometry(zoneRec.geometry) : null;
				if (polygon) {
					features.push(polygon);
				}
			}
		}
		return { features };
	}

	return EMPTY_SCENE;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web test -- scene-builders.test.ts`
Expected: PASS (all input + result cases).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web check-types`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/sdk-playground/scene-builders.ts apps/web/src/components/sdk-playground/scene-builders.test.ts
git commit -m "feat(web): sceneFromResult builder for the playground map"
```

---

## Task 4: `SdkResultMap` component

**Files:**
- Create: `apps/web/src/components/sdk-playground/sdk-result-map.tsx`
- Test: `apps/web/src/components/sdk-playground/sdk-result-map.test.tsx`

- [ ] **Step 1: Write the failing empty-state test**

Create `apps/web/src/components/sdk-playground/sdk-result-map.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EMPTY_SCENE } from "./map-scene.ts";
import { SdkResultMap } from "./sdk-result-map.tsx";

describe("SdkResultMap", () => {
	it("shows the empty-state message when the scene has no features", () => {
		render(<SdkResultMap scene={EMPTY_SCENE} />);
		expect(screen.getByText(/no map view/i)).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web test -- sdk-result-map.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `apps/web/src/components/sdk-playground/sdk-result-map.tsx`. The scene-sync
effect builds a single GeoJSON `FeatureCollection` for lines/polygons/circles plus
DOM `Marker`s, replacing prior content each run.

```tsx
import type {
	GeoJSONSource,
	LngLatBoundsLike,
	Map as MapLibreMap,
	Marker as MapLibreMarker,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { MapCanvas } from "../map/map-canvas.tsx";
import type { MapFeature, MapScene, MarkerRole } from "./map-scene.ts";

interface SdkResultMapProps {
	scene: MapScene;
}

const SOURCE_ID = "sdk-scene";
const LINE_LAYER = "sdk-scene-line";
const FILL_LAYER = "sdk-scene-fill";
const STROKE_LAYER = "sdk-scene-stroke";
const CIRCLE_SEGMENTS = 64;
const EARTH_RADIUS_M = 6_378_137;

function circleRing(
	center: [number, number],
	radiusM: number
): [number, number][] {
	const [lng, lat] = center;
	const latRad = (lat * Math.PI) / 180;
	const ring: [number, number][] = [];
	for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
		const angle = (i / CIRCLE_SEGMENTS) * 2 * Math.PI;
		const dLat = (radiusM * Math.cos(angle)) / EARTH_RADIUS_M;
		const dLng =
			(radiusM * Math.sin(angle)) / (EARTH_RADIUS_M * Math.cos(latRad));
		ring.push([
			lng + (dLng * 180) / Math.PI,
			lat + (dLat * 180) / Math.PI,
		]);
	}
	return ring;
}

// biome-ignore lint/suspicious/noExplicitAny: GeoJSON feature shape varies by kind
function sceneToGeoJson(features: MapFeature[]): any {
	const collection: { type: "FeatureCollection"; features: unknown[] } = {
		type: "FeatureCollection",
		features: [],
	};
	for (const f of features) {
		if (f.kind === "line") {
			collection.features.push({
				type: "Feature",
				properties: { kind: "line" },
				geometry: { type: "LineString", coordinates: f.coordinates },
			});
		} else if (f.kind === "polygon") {
			collection.features.push({
				type: "Feature",
				properties: { kind: "polygon" },
				geometry: { type: "Polygon", coordinates: f.rings },
			});
		} else if (f.kind === "circle") {
			collection.features.push({
				type: "Feature",
				properties: { kind: "circle" },
				geometry: { type: "Polygon", coordinates: [circleRing(f.center, f.radiusM)] },
			});
		}
	}
	return collection;
}

function collectBounds(features: MapFeature[]): [number, number][] {
	const pts: [number, number][] = [];
	for (const f of features) {
		if (f.kind === "marker") {
			pts.push(f.lngLat);
		} else if (f.kind === "line") {
			pts.push(...f.coordinates);
		} else if (f.kind === "polygon") {
			for (const ring of f.rings) {
				pts.push(...ring);
			}
		} else if (f.kind === "circle") {
			pts.push(...circleRing(f.center, f.radiusM));
		}
	}
	return pts;
}

function markerColor(role: MarkerRole): string {
	switch (role) {
		case "from":
			return "#16a34a";
		case "to":
			return "#dc2626";
		case "result":
			return "#2563eb";
		default:
			return "#7c3aed";
	}
}

export function SdkResultMap({ scene }: SdkResultMapProps) {
	const mapRef = useRef<MapLibreMap | null>(null);
	const markersRef = useRef<MapLibreMarker[]>([]);
	const [hasMap, setHasMap] = useState(false);

	useEffect(() => {
		const map = mapRef.current;
		if (!(map && hasMap)) {
			return;
		}
		let cancelled = false;

		import("maplibre-gl").then(({ Marker }) => {
			if (cancelled) {
				return;
			}
			// 1. Clear previous markers.
			for (const m of markersRef.current) {
				m.remove();
			}
			markersRef.current = [];

			// 2. Update / create the shared GeoJSON source.
			const data = sceneToGeoJson(scene.features);
			const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
			if (existing) {
				existing.setData(data);
			} else {
				map.addSource(SOURCE_ID, { type: "geojson", data });
				map.addLayer({
					id: FILL_LAYER,
					type: "fill",
					source: SOURCE_ID,
					filter: ["==", ["get", "kind"], "polygon"],
					paint: { "fill-color": "#2563eb", "fill-opacity": 0.15 },
				});
				map.addLayer({
					id: STROKE_LAYER,
					type: "line",
					source: SOURCE_ID,
					filter: ["in", ["get", "kind"], ["literal", ["polygon", "circle"]]],
					paint: { "line-color": "#2563eb", "line-width": 1.5 },
				});
				map.addLayer({
					id: LINE_LAYER,
					type: "line",
					source: SOURCE_ID,
					filter: ["==", ["get", "kind"], "line"],
					paint: { "line-color": "#2563eb", "line-width": 3 },
				});
			}

			// 3. Add markers.
			for (const f of scene.features) {
				if (f.kind === "marker") {
					const marker = new Marker({ color: markerColor(f.role) })
						.setLngLat(f.lngLat)
						.addTo(map);
					markersRef.current.push(marker);
				}
			}

			// 4. Fit bounds.
			const pts = collectBounds(scene.features);
			if (pts.length === 1) {
				map.jumpTo({ center: pts[0], zoom: 13 });
			} else if (pts.length > 1) {
				let minLng = 180;
				let minLat = 90;
				let maxLng = -180;
				let maxLat = -90;
				for (const [lng, lat] of pts) {
					minLng = Math.min(minLng, lng);
					minLat = Math.min(minLat, lat);
					maxLng = Math.max(maxLng, lng);
					maxLat = Math.max(maxLat, lat);
				}
				const bounds: LngLatBoundsLike = [
					[minLng, minLat],
					[maxLng, maxLat],
				];
				map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
			}
		});

		return () => {
			cancelled = true;
		};
	}, [scene, hasMap]);

	if (scene.features.length === 0) {
		return (
			<div
				className="flex items-center justify-center rounded border text-muted-foreground text-sm"
				style={{ minHeight: 360 }}
			>
				This method has no map view.
			</div>
		);
	}

	return (
		<MapCanvas
			onMapReady={(map) => {
				mapRef.current = map;
				setHasMap(true);
			}}
		/>
	);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web test -- sdk-result-map.test.tsx`
Expected: PASS — empty scene renders the message; MapLibre is never imported in this path.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web check-types`
Expected: no errors.

- [ ] **Step 6: Lint/format**

Run: `pnpm dlx ultracite fix apps/web/src/components/sdk-playground/sdk-result-map.tsx`
Expected: formatted, no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/sdk-playground/sdk-result-map.tsx apps/web/src/components/sdk-playground/sdk-result-map.test.tsx
git commit -m "feat(web): SdkResultMap renders scene features over the basemap"
```

---

## Task 5: Wire the map into the playground

**Files:**
- Modify: `apps/web/src/components/sdk-playground.tsx`

- [ ] **Step 1: Add imports**

In `apps/web/src/components/sdk-playground.tsx`, add after the existing imports:

```tsx
import { type MapScene, EMPTY_SCENE } from "./sdk-playground/map-scene.ts";
import {
	sceneFromInputs,
	sceneFromResult,
} from "./sdk-playground/scene-builders.ts";
import { SdkResultMap } from "./sdk-playground/sdk-result-map.tsx";
```

- [ ] **Step 2: Add result-scene state and derive the combined scene**

After the existing `const [result, setResult] = useState<string | null>(null);`
line, add:

```tsx
	const [resultScene, setResultScene] = useState<MapScene>(EMPTY_SCENE);
```

After the `snippet` is computed (before `run`), add:

```tsx
	const inputScene = endpoint
		? sceneFromInputs(endpoint.id, paramValues)
		: EMPTY_SCENE;
	const scene: MapScene = {
		features: [...inputScene.features, ...resultScene.features],
	};
```

- [ ] **Step 3: Reset result scene on method change, set it on success**

Add this effect near the top of the component body (after state declarations).
Import `useEffect` if not already imported (the file already imports from "react";
add `useEffect` to that import list):

```tsx
	useEffect(() => {
		setResultScene(EMPTY_SCENE);
	}, [endpointId]);
```

In `run()`, immediately after `setResult(JSON.stringify(res.body, null, 2));`, add:

```tsx
				setResultScene(
					endpoint ? sceneFromResult(endpoint.id, res.body) : EMPTY_SCENE
				);
```

And in the same `run()`, in the `catch` block right after `setResult(...)`, add:

```tsx
				setResultScene(EMPTY_SCENE);
```

- [ ] **Step 4: Render the map card below the two-column row**

Wrap the existing returned two-column `<div className="grid gap-4 lg:grid-cols-2">…</div>`
so a map card follows it. Replace the outer `return (` block's top-level so the
two-column grid and the new card are siblings inside a fragment:

```tsx
	return (
		<div className="flex flex-col gap-4">
			<div className="grid gap-4 lg:grid-cols-2">
				{/* …existing Method card and SDK code card, unchanged… */}
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Map</CardTitle>
				</CardHeader>
				<CardContent>
					<div style={{ height: 360 }}>
						<SdkResultMap scene={scene} />
					</div>
				</CardContent>
			</Card>
		</div>
	);
```

(Keep the two existing `<Card>` blocks exactly as they are inside the grid. `Card`,
`CardContent`, `CardHeader`, `CardTitle` are already imported in this file.)

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web check-types`
Expected: no errors.

- [ ] **Step 6: Run the full web test suite**

Run: `pnpm --filter web test`
Expected: PASS, including `scene-builders.test.ts`, `sdk-result-map.test.tsx`, and
pre-existing playground tests.

- [ ] **Step 7: Lint/format**

Run: `pnpm dlx ultracite fix apps/web/src/components/sdk-playground.tsx`
Expected: formatted, no errors.

- [ ] **Step 8: Manual smoke test**

Run: `pnpm --filter web dev`
At `/sdk-playground`:
1. `routing.directions`: pick `from`/`to`; confirm two markers appear and the map
   fits to them. Run; confirm a route line draws and the map refits.
2. `addresses.nearby`: enter `lat`/`lng`/`radius`; confirm a center marker + radius
   circle; Run; confirm result point markers.
3. `addresses.geocode`: Run with a query; confirm a single result marker.
4. `zones.list`: Run; confirm polygons render.
5. `webhooks.create`: confirm the "This method has no map view." empty-state.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/sdk-playground.tsx
git commit -m "feat(web): show result map panel in the SDK playground"
```

---

## Self-Review

**Spec coverage:**
- Neutral `MapScene` model → Task 1. ✓
- `sceneFromInputs` (routing/nearby/reverse, skip non-coords, empty for non-geo) → Task 2. ✓
- `sceneFromResult` (routing line+endpoints, geocode/reverse point, autocomplete/nearby markers, zones polygons, byId, error/unknown → empty) → Task 3. ✓
- `SdkResultMap` reuses `MapCanvas`, syncs sources/markers, fits bounds, circle-as-polygon, empty-state → Task 4. ✓
- Both input + result scenes merged; full-width card below; read-only → Task 5. ✓
- Edge cases: place-name skip (T2), malformed/error JSON (T3), single-point fit (T4), non-geo empty-state (T4), SSR via MapCanvas guard (T4). ✓

**Type consistency:** `MapFeature`/`MapScene`/`MarkerRole` (T1) are the only shared
types; `sceneFromInputs`/`sceneFromResult` (T2/T3) return `MapScene`; `SdkResultMap`
(T4) consumes `MapScene`; playground (T5) merges two `MapScene`s. `EMPTY_SCENE` is
imported consistently from `map-scene.ts`. Builder marker output `{ kind, lngLat,
label, role }` matches the `MapFeature` marker variant exactly.

**Placeholder scan:** no TBD/TODO; every code step shows complete code; commands
have expected output.
