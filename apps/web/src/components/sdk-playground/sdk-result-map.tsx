import type {
	GeoJSONSource,
	LngLatBoundsLike,
	Map as MapLibreMap,
	Marker as MapLibreMarker,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { MapCanvas } from "@/components/map/map-canvas";
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
		ring.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
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
				geometry: {
					type: "Polygon",
					coordinates: [circleRing(f.center, f.radiusM)],
				},
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

function addSceneLayers(map: MapLibreMap, data: unknown): void {
	map.addSource(SOURCE_ID, { type: "geojson", data: data as never });
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

function syncSource(map: MapLibreMap, features: MapFeature[]): void {
	const data = sceneToGeoJson(features);
	const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
	if (existing) {
		existing.setData(data);
	} else {
		addSceneLayers(map, data);
	}
}

function fitToFeatures(map: MapLibreMap, features: MapFeature[]): void {
	const pts = collectBounds(features);
	if (pts.length === 1) {
		map.jumpTo({ center: pts[0], zoom: 13 });
		return;
	}
	if (pts.length <= 1) {
		return;
	}
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
			syncSource(map, scene.features);

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
			fitToFeatures(map, scene.features);
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
