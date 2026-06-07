import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { orpcClient } from "@/lib/orpc";

const SRC = "gnaf-addresses";
const ZOOM_FLOOR = 14;
const DEBOUNCE_MS = 350;
const FETCH_LIMIT = 2000;

interface FeatureCollection {
	features: Array<{
		type: "Feature";
		properties: { id: number; label: string };
		geometry: { type: "Point"; coordinates: [number, number] };
	}>;
	type: "FeatureCollection";
}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/** Adds a clustered G-NAF address overlay that loads on pan/zoom at z>=14. */
export function useAddressOverlay(map: MapLibreMap | null) {
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reqIdRef = useRef(0);

	useEffect(() => {
		if (!map) {
			return;
		}

		const ensureLayers = () => {
			if (map.getSource(SRC)) {
				return;
			}
			map.addSource(SRC, {
				type: "geojson",
				data: EMPTY,
				cluster: true,
				clusterRadius: 50,
				clusterMaxZoom: 16,
				// biome-ignore lint/suspicious/noExplicitAny: maplibre source typing
			} as any);
			map.addLayer({
				id: "gnaf-clusters",
				type: "circle",
				source: SRC,
				filter: ["has", "point_count"],
				paint: {
					"circle-color": "#0ea5e9",
					"circle-opacity": 0.65,
					"circle-radius": [
						"step",
						["get", "point_count"],
						14,
						100,
						18,
						1000,
						24,
					],
				},
			});
			map.addLayer({
				id: "gnaf-cluster-count",
				type: "symbol",
				source: SRC,
				filter: ["has", "point_count"],
				layout: {
					"text-field": ["get", "point_count_abbreviated"],
					"text-size": 12,
				},
				paint: { "text-color": "#ffffff" },
			});
			map.addLayer({
				id: "gnaf-point",
				type: "circle",
				source: SRC,
				filter: ["!", ["has", "point_count"]],
				paint: {
					"circle-color": "#38bdf8",
					"circle-radius": 4,
					"circle-stroke-width": 1,
					"circle-stroke-color": "#0c4a6e",
				},
			});
		};

		const clear = () => {
			const src = map.getSource(SRC);
			if (src) {
				// biome-ignore lint/suspicious/noExplicitAny: GeoJSONSource setData
				(src as any).setData(EMPTY);
			}
		};

		const refresh = async () => {
			if (map.getZoom() < ZOOM_FLOOR) {
				clear();
				return;
			}
			ensureLayers();
			const b = map.getBounds();
			const bbox: [number, number, number, number] = [
				b.getWest(),
				b.getSouth(),
				b.getEast(),
				b.getNorth(),
			];
			const reqId = ++reqIdRef.current;
			try {
				const res = await orpcClient.zones.inViewport({
					bbox,
					limit: FETCH_LIMIT,
				});
				if (reqId !== reqIdRef.current) {
					return; // stale response
				}
				const fc: FeatureCollection = {
					type: "FeatureCollection",
					features: res.results.map((a) => ({
						type: "Feature",
						properties: { id: a.id, label: a.label },
						geometry: { type: "Point", coordinates: [a.lng, a.lat] },
					})),
				};
				const src = map.getSource(SRC);
				if (src) {
					// biome-ignore lint/suspicious/noExplicitAny: GeoJSONSource setData
					(src as any).setData(fc);
				}
			} catch {
				// Non-critical: keep last data on failure (codebase convention).
			}
		};

		const onMove = () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
			timerRef.current = setTimeout(refresh, DEBOUNCE_MS);
		};

		const onPointClick = (e: {
			lngLat: { lng: number; lat: number };
			features?: Array<{ properties?: { label?: string } }>;
		}) => {
			const label = e.features?.[0]?.properties?.label;
			if (!label) {
				return;
			}
			import("maplibre-gl").then(({ Popup }) => {
				new Popup({ closeButton: true })
					.setLngLat([e.lngLat.lng, e.lngLat.lat])
					.setText(label)
					.addTo(map);
			});
		};

		map.on("moveend", onMove);
		// biome-ignore lint/suspicious/noExplicitAny: maplibre layer event typing
		map.on("click", "gnaf-point", onPointClick as any);
		refresh();

		return () => {
			map.off("moveend", onMove);
			// biome-ignore lint/suspicious/noExplicitAny: maplibre layer event typing
			map.off("click", "gnaf-point", onPointClick as any);
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
		};
	}, [map]);
}
