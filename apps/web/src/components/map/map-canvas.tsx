import "maplibre-gl/dist/maplibre-gl.css";
import { env } from "@wherabouts.com/env/web";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { buildMapStyle } from "./map-style.ts";

export interface MapCanvasProps {
	/** [lng, lat] */
	center?: [number, number];
	className?: string;
	/** Called once the map has loaded; attach layers/markers/draw here. */
	onMapReady?: (map: MapLibreMap) => void;
	zoom?: number;
}

// Sydney CBD default
const DEFAULT_CENTER: [number, number] = [151.2093, -33.8688];
const DEFAULT_ZOOM = 10;

export function MapCanvas({
	center = DEFAULT_CENTER,
	zoom = DEFAULT_ZOOM,
	onMapReady,
	className,
}: MapCanvasProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMap | null>(null);

	useEffect(() => {
		if (typeof window === "undefined" || !containerRef.current) {
			return;
		}
		let cancelled = false;
		let map: MapLibreMap | null = null;

		import("maplibre-gl").then(({ Map: MapCtor }) => {
			if (cancelled || !containerRef.current) {
				return;
			}
			map = new MapCtor({
				container: containerRef.current,
				style: buildMapStyle(env.VITE_TILES_BASE_URL) as never,
				center,
				zoom,
			});
			mapRef.current = map;
			map.on("load", () => {
				if (!cancelled && map) {
					onMapReady?.(map);
				}
			});
		});

		return () => {
			cancelled = true;
			map?.remove();
			mapRef.current = null;
		};
		// Mount-once: center/zoom changes after mount are driven via the map instance.
		// biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-once
	}, []);

	return (
		<div
			className={className}
			ref={containerRef}
			style={{ width: "100%", height: "100%", minHeight: 360 }}
		/>
	);
}
