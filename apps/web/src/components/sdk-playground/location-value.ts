// Mirrors parseLatLng in packages/api/src/shared/routing-queries.ts:36.
const LAT_MAX = 90;
const LNG_MAX = 180;

export function isValidLatLng(raw: string): boolean {
	const parts = raw.split(",");
	if (parts.length !== 2) {
		return false;
	}
	const lat = Number(parts[0]);
	const lng = Number(parts[1]);
	if (!(Number.isFinite(lat) && Number.isFinite(lng))) {
		return false;
	}
	return Math.abs(lat) <= LAT_MAX && Math.abs(lng) <= LNG_MAX;
}

export function coordValueFromCandidate(c: {
	latitude: number;
	longitude: number;
}): string {
	return `${c.latitude},${c.longitude}`;
}
