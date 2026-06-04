import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoJsonPolygon } from "@wherabouts.com/api/routers/public/zones-schema";
import { featureToPolygon, polygonToFeature, type DrawFeature } from "./geometry.ts";

export interface UseZoneDraw {
	startDrawing: () => void;
	stopDrawing: () => void;
	clear: () => void;
	loadPolygon: (polygon: GeoJsonPolygon) => void;
	drawnPolygon: GeoJsonPolygon | null;
	resetDrawn: () => void;
}

export function useZoneDraw(map: MapLibreMap | null): UseZoneDraw {
	// biome-ignore lint/suspicious/noExplicitAny: terra-draw instance type
	const drawRef = useRef<any>(null);
	const [drawnPolygon, setDrawnPolygon] = useState<GeoJsonPolygon | null>(null);

	useEffect(() => {
		if (!map) {
			return;
		}
		let disposed = false;
		Promise.all([
			import("terra-draw"),
			import("terra-draw-maplibre-gl-adapter"),
		]).then(([terra, adapterMod]) => {
			if (disposed) {
				return;
			}
			const { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } = terra;
			const { TerraDrawMapLibreGLAdapter } = adapterMod;
			const draw = new TerraDraw({
				adapter: new TerraDrawMapLibreGLAdapter({ map }),
				modes: [new TerraDrawPolygonMode(), new TerraDrawSelectMode()],
			});
			draw.start();

			const captureLatest = () => {
				// biome-ignore lint/suspicious/noExplicitAny: terra-draw snapshot typing
				const snapshot = draw.getSnapshot() as any[];
				const polygonFeatures = snapshot.filter(
					// biome-ignore lint/suspicious/noExplicitAny: runtime shape check
					(f: any) => f.geometry?.type === "Polygon",
				);
				const last = polygonFeatures.at(-1) as DrawFeature | undefined;
				if (last) {
					const polygon = featureToPolygon(last);
					if (polygon) {
						setDrawnPolygon(polygon);
					}
				}
			};

			// "finish" fires when a polygon is completed; "change" covers vertex edits in select mode
			draw.on("finish", captureLatest);
			draw.on("change", captureLatest);
			drawRef.current = draw;
		});

		return () => {
			disposed = true;
			if (drawRef.current) {
				drawRef.current.stop();
				drawRef.current = null;
			}
		};
	}, [map]);

	const startDrawing = useCallback(() => {
		drawRef.current?.setMode("polygon");
	}, []);

	const stopDrawing = useCallback(() => {
		drawRef.current?.setMode("select");
	}, []);

	const clear = useCallback(() => {
		drawRef.current?.clear();
		setDrawnPolygon(null);
	}, []);

	const loadPolygon = useCallback((polygon: GeoJsonPolygon) => {
		if (!drawRef.current) {
			return;
		}
		drawRef.current.clear();
		// biome-ignore lint/suspicious/noExplicitAny: addFeatures expects GeoJSONStoreFeatures shape
		drawRef.current.addFeatures([polygonToFeature(polygon) as any]);
	}, []);

	const resetDrawn = useCallback(() => setDrawnPolygon(null), []);

	return { startDrawing, stopDrawing, clear, loadPolygon, drawnPolygon, resetDrawn };
}
