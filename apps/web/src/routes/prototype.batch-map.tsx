// PROTOTYPE — throwaway. Evaluating mapcn (MapLibre) for batch-geocode result maps.
// Question: "Does mapcn's cluster map look + feel good for our batch results against real AU data?"
// Three structurally-different variants on one route, switch via ?variant=A|B|C (or arrow keys).
// Real data via /api/prototype-batch-points (samples the GNAF addresses table).
// Delete this file + the data route + (optionally) the vendored map.tsx when done.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	Map,
	MapClusterLayer,
	MapControls,
	MapPopup,
	type MapRef,
	useMap,
} from "@wherabouts.com/ui/components/ui/map";
import { useEffect, useRef, useState } from "react";

type PointProps = { state: string | null; postcode: string | null };
type FeatureCollection = {
	type: "FeatureCollection";
	features: Array<{
		type: "Feature";
		geometry: { type: "Point"; coordinates: [number, number] };
		properties: PointProps;
	}>;
};

const AU_CENTER: [number, number] = [134.0, -25.6];
const AU_ZOOM = 3.4;
const CLUSTER_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899"];
const VARIANTS = ["A", "B", "C"] as const;
const VARIANT_NAMES: Record<string, string> = {
	A: "Clusters (full-bleed)",
	B: "Heatmap density",
	C: "Split map + results list",
};

export const Route = createFileRoute("/prototype/batch-map")({
	validateSearch: (s: Record<string, unknown>) => ({
		variant: typeof s.variant === "string" ? s.variant : "A",
	}),
	component: PrototypeBatchMap,
});

function useBatchPoints() {
	const [geo, setGeo] = useState<FeatureCollection | null>(null);
	useEffect(() => {
		fetch("/api/prototype-batch-points?n=5000")
			.then((r) => r.json())
			.then(setGeo)
			.catch(() => setGeo({ type: "FeatureCollection", features: [] }));
	}, []);
	return geo;
}

function PrototypeBatchMap() {
	const { variant } = Route.useSearch();
	const geo = useBatchPoints();
	const count = geo?.features.length ?? 0;

	return (
		<div className="dark relative h-screen w-screen bg-background text-foreground">
			<div className="absolute top-3 left-3 z-10 rounded-md border bg-background/80 px-3 py-2 backdrop-blur">
				<p className="font-medium text-sm">Batch job #demo — results</p>
				<p className="text-muted-foreground text-xs">
					{geo ? `${count.toLocaleString()} geocoded points` : "Loading…"}
				</p>
			</div>

			{geo && variant === "A" && <VariantClusters geo={geo} />}
			{geo && variant === "B" && <VariantHeatmap geo={geo} />}
			{geo && variant === "C" && <VariantSplit geo={geo} />}

			<PrototypeSwitcher current={variant} />
		</div>
	);
}

// --- Variant A: full-bleed clusters -----------------------------------------
function VariantClusters({ geo }: { geo: FeatureCollection }) {
	const [selected, setSelected] = useState<{
		coordinates: [number, number];
		properties: PointProps;
	} | null>(null);

	return (
		<div className="h-full w-full">
			<Map center={AU_CENTER} fadeDuration={0} zoom={AU_ZOOM}>
				<MapClusterLayer<PointProps>
					clusterColors={CLUSTER_COLORS}
					clusterMaxZoom={14}
					clusterRadius={50}
					data={geo}
					onPointClick={(feature, coordinates) =>
						setSelected({ coordinates, properties: feature.properties })
					}
					pointColor="#3b82f6"
				/>
				{selected && (
					<MapPopup
						className="w-40"
						closeButton
						closeOnClick={false}
						key={`${selected.coordinates[0]}-${selected.coordinates[1]}`}
						latitude={selected.coordinates[1]}
						longitude={selected.coordinates[0]}
						onClose={() => setSelected(null)}
					>
						<div className="text-[13px]">
							<p className="font-medium text-foreground">
								{selected.properties.state ?? "—"}
							</p>
							<p className="text-muted-foreground">
								{selected.properties.postcode ?? "no postcode"}
							</p>
							<p className="mt-1 font-mono text-[11px] text-muted-foreground">
								{selected.coordinates[1].toFixed(4)},{" "}
								{selected.coordinates[0].toFixed(4)}
							</p>
						</div>
					</MapPopup>
				)}
				<MapControls />
			</Map>
		</div>
	);
}

// --- Variant B: heatmap density (raw MapLibre layer via useMap) --------------
function HeatmapLayer({ geo }: { geo: FeatureCollection }) {
	const { map, isLoaded } = useMap();
	useEffect(() => {
		if (!(map && isLoaded)) {
			return;
		}
		const SRC = "proto-heat-src";
		const LYR = "proto-heat-layer";
		if (!map.getSource(SRC)) {
			map.addSource(SRC, { type: "geojson", data: geo });
			map.addLayer({
				id: LYR,
				type: "heatmap",
				source: SRC,
				paint: {
					"heatmap-radius": 20,
					"heatmap-intensity": 1,
					"heatmap-opacity": 0.85,
				},
			});
		}
		return () => {
			// On unmount (e.g. switching variants) the <Map> may have already
			// torn down the MapLibre instance, leaving map.style undefined —
			// calling getLayer/removeLayer then throws. Skip if removed.
			if ((map as unknown as { _removed?: boolean })._removed) {
				return;
			}
			try {
				if (map.getLayer(LYR)) {
					map.removeLayer(LYR);
				}
				if (map.getSource(SRC)) {
					map.removeSource(SRC);
				}
			} catch {
				// Map torn down during unmount — nothing to clean up.
			}
		};
	}, [map, isLoaded, geo]);
	return null;
}

function VariantHeatmap({ geo }: { geo: FeatureCollection }) {
	return (
		<div className="h-full w-full">
			<Map center={AU_CENTER} fadeDuration={0} zoom={AU_ZOOM}>
				<HeatmapLayer geo={geo} />
				<MapControls />
			</Map>
		</div>
	);
}

// --- Variant C: split map + scrollable results list -------------------------
function VariantSplit({ geo }: { geo: FeatureCollection }) {
	const mapRef = useRef<MapRef>(null);
	const rows = geo.features.slice(0, 250);

	return (
		<div className="grid h-full w-full grid-cols-[1fr_320px]">
			<div className="h-full">
				<Map center={AU_CENTER} fadeDuration={0} ref={mapRef} zoom={AU_ZOOM}>
					<MapClusterLayer<PointProps>
						clusterColors={CLUSTER_COLORS}
						clusterMaxZoom={14}
						clusterRadius={50}
						data={geo}
						pointColor="#3b82f6"
					/>
					<MapControls />
				</Map>
			</div>
			<div className="h-full overflow-auto border-l bg-background">
				<div className="sticky top-0 border-b bg-background/95 px-3 py-2 text-muted-foreground text-xs backdrop-blur">
					Showing first {rows.length} of {geo.features.length.toLocaleString()}
				</div>
				<ul>
					{rows.map((f, i) => {
						const [lng, lat] = f.geometry.coordinates;
						return (
							<li key={`${lng}-${lat}-${i}`}>
								<button
									className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-xs hover:bg-muted"
									onClick={() =>
										mapRef.current?.flyTo({ center: [lng, lat], zoom: 14 })
									}
									type="button"
								>
									<span className="font-medium">
										{f.properties.state ?? "—"} {f.properties.postcode ?? ""}
									</span>
									<span className="font-mono text-[10px] text-muted-foreground">
										{lat.toFixed(3)}, {lng.toFixed(3)}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}

// --- Floating variant switcher (dev-only) -----------------------------------
function PrototypeSwitcher({ current }: { current: string }) {
	const navigate = useNavigate();
	const idx = Math.max(
		0,
		VARIANTS.indexOf(current as (typeof VARIANTS)[number])
	);

	useEffect(() => {
		if (import.meta.env.PROD) {
			return;
		}
		const onKey = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") {
				return;
			}
			if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				const delta = e.key === "ArrowRight" ? 1 : -1;
				const next =
					VARIANTS[(idx + delta + VARIANTS.length) % VARIANTS.length];
				navigate({ to: "/prototype/batch-map", search: { variant: next } });
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [idx, navigate]);

	if (import.meta.env.PROD) {
		return null;
	}

	const go = (delta: number) => {
		const next = VARIANTS[(idx + delta + VARIANTS.length) % VARIANTS.length];
		navigate({ to: "/prototype/batch-map", search: { variant: next } });
	};

	return (
		<div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/80 px-2 py-1.5 text-white shadow-lg backdrop-blur">
			<button
				className="rounded-full px-2 py-0.5 hover:bg-white/15"
				onClick={() => go(-1)}
				type="button"
			>
				←
			</button>
			<span className="min-w-[200px] text-center font-medium text-xs">
				{current} — {VARIANT_NAMES[current] ?? "?"}
			</span>
			<button
				className="rounded-full px-2 py-0.5 hover:bg-white/15"
				onClick={() => go(1)}
				type="button"
			>
				→
			</button>
		</div>
	);
}
