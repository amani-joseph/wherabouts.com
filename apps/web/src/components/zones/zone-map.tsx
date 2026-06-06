import type { ZoneWithGeometryRow } from "@wherabouts.com/api/shared/zone-queries";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { MapCanvas } from "@/components/map/map-canvas";
import { useAddressOverlay } from "./use-address-overlay.ts";
import { type UseZoneDraw, useZoneDraw } from "./use-zone-draw.ts";

const EXISTING_SRC = "existing-zones";
const MAP_HEIGHT_PX = 480;

export interface ZoneMapProps {
	onReady?: (controls: UseZoneDraw) => void;
	zones: ZoneWithGeometryRow[];
}

export function ZoneMap({ zones, onReady }: ZoneMapProps) {
	const [map, setMap] = useState<MapLibreMap | null>(null);
	const draw = useZoneDraw(map);
	useAddressOverlay(map);

	const onReadyRef = useRef(onReady);
	onReadyRef.current = onReady;
	const readyFiredRef = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: draw in deps satisfies lint; readyFiredRef guard ensures body runs once only
	useEffect(() => {
		if (map && !readyFiredRef.current) {
			readyFiredRef.current = true;
			onReadyRef.current?.(draw);
		}
	}, [map, draw]);

	useEffect(() => {
		if (!map) {
			return;
		}
		const fc = {
			type: "FeatureCollection" as const,
			features: zones.map((z) => ({
				type: "Feature" as const,
				properties: { id: z.id, name: z.name },
				geometry: z.geometry,
			})),
		};
		const existing = map.getSource(EXISTING_SRC);
		if (existing) {
			// biome-ignore lint/suspicious/noExplicitAny: GeoJSONSource setData
			(existing as any).setData(fc);
			return;
		}
		// biome-ignore lint/suspicious/noExplicitAny: maplibre source typing
		map.addSource(EXISTING_SRC, { type: "geojson", data: fc } as any);
		map.addLayer({
			id: "existing-zones-fill",
			type: "fill",
			source: EXISTING_SRC,
			paint: { "fill-color": "#6366f1", "fill-opacity": 0.15 },
		});
		map.addLayer({
			id: "existing-zones-line",
			type: "line",
			source: EXISTING_SRC,
			paint: { "line-color": "#6366f1", "line-width": 2 },
		});
	}, [map, zones]);

	return (
		<div style={{ height: MAP_HEIGHT_PX }}>
			<MapCanvas onMapReady={setMap} />
		</div>
	);
}
