// Dependency-free geo convenience helpers. Wherabouts records expose flat
// `latitude`/`longitude`; map UIs and GeoJSON want different shapes. These save
// consumers from reshaping by hand (mirrors use-places-autocomplete's
// getLatLng/getZipCode utilities).

export interface LatLng {
	lat: number;
	lng: number;
}

interface HasCoords {
	latitude: number;
	longitude: number;
}

/** `{ latitude, longitude }` → `{ lat, lng }` (e.g. for Leaflet/Google Maps). */
export function getLatLng(point: HasCoords): LatLng {
	return { lat: point.latitude, lng: point.longitude };
}

/** `{ latitude, longitude }` → `[lng, lat]` (GeoJSON / MapLibre coordinate order). */
export function toLngLat(point: HasCoords): [number, number] {
	return [point.longitude, point.latitude];
}

const EARTH_RADIUS_M = 6_371_000;
const DEG = Math.PI / 180;

/**
 * Great-circle distance in metres between two points (haversine). Handy for
 * client-side "how far is this result" without a round-trip.
 */
export function distanceMeters(a: HasCoords, b: HasCoords): number {
	const dLat = (b.latitude - a.latitude) * DEG;
	const dLng = (b.longitude - a.longitude) * DEG;
	const lat1 = a.latitude * DEG;
	const lat2 = b.latitude * DEG;
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}
