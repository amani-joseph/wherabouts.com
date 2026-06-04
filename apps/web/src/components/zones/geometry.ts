import type { GeoJsonPolygon } from "@wherabouts.com/api/routers/public/zones-schema";

export interface DrawFeature {
	type: "Feature";
	properties: Record<string, unknown>;
	geometry: {
		type: string;
		coordinates: unknown;
	};
}

/** Ensure a linear ring is closed (first coord repeated at the end). */
export function closeRing(ring: [number, number][]): [number, number][] {
	if (ring.length === 0) {
		return ring;
	}
	const first = ring[0];
	const last = ring[ring.length - 1];
	if (first[0] === last[0] && first[1] === last[1]) {
		return ring;
	}
	return [...ring, first];
}

/** Convert a terra-draw Polygon Feature into our API's GeoJsonPolygon. */
export function featureToPolygon(feature: DrawFeature): GeoJsonPolygon | null {
	if (feature.geometry.type !== "Polygon") {
		return null;
	}
	const rings = feature.geometry.coordinates as [number, number][][];
	return {
		type: "Polygon",
		coordinates: rings.map(closeRing),
	};
}

/** Build a terra-draw-compatible Feature from a stored polygon (for editing). */
export function polygonToFeature(
	polygon: GeoJsonPolygon,
	id?: string
): DrawFeature & { id?: string } {
	return {
		...(id ? { id } : {}),
		type: "Feature",
		properties: { mode: "polygon" },
		geometry: { type: "Polygon", coordinates: polygon.coordinates },
	};
}
