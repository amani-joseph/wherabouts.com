export type MarkerRole = "from" | "to" | "point" | "center" | "result";

export type MapFeature =
	| {
			kind: "marker";
			lngLat: [number, number];
			label: string;
			role: MarkerRole;
	  }
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
