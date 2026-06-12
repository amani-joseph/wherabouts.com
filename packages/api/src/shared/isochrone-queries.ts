import type { LatLng } from "./routing-queries.ts";

// Sampling density (D4): ISO_BEARINGS bearings × ISO_RADIUS_STEPS concentric
// radii around the origin. Total samples (+ the origin) must stay under the
// OSRM /table coordinate cap — 12 × 6 = 72 samples + origin = 73 ≤ 100.
const ISO_BEARINGS = 12;
const ISO_RADIUS_STEPS = 6;

/** Number of destination points `generateSamplePoints` produces. */
export const ISO_SAMPLE_COUNT = ISO_BEARINGS * ISO_RADIUS_STEPS;

const EARTH_RADIUS_M = 6_371_000;
const DEG = Math.PI / 180;
const FULL_TURN = 2 * Math.PI;

export interface SampleOptions {
	/** Outer sampling radius in metres (scale to the travel budget upstream). */
	maxRadiusMeters: number;
}

/**
 * Deterministic ring/grid of destination points around the origin:
 * `ISO_BEARINGS` bearings × `ISO_RADIUS_STEPS` radii (innermost = one step,
 * outermost = `maxRadiusMeters`). Pure — no I/O. Uses an equirectangular
 * metres→degrees approximation, adequate at AU latitudes.
 */
export function generateSamplePoints(
	origin: LatLng,
	opts: SampleOptions
): LatLng[] {
	const points: LatLng[] = [];
	const latRad = origin.lat * DEG;
	const cosLat = Math.cos(latRad);

	for (let step = 1; step <= ISO_RADIUS_STEPS; step++) {
		const radius = (opts.maxRadiusMeters * step) / ISO_RADIUS_STEPS;
		for (let b = 0; b < ISO_BEARINGS; b++) {
			const bearing = (FULL_TURN * b) / ISO_BEARINGS;
			const dNorth = radius * Math.cos(bearing);
			const dEast = radius * Math.sin(bearing);
			const dLat = dNorth / EARTH_RADIUS_M / DEG;
			const dLng = dEast / (EARTH_RADIUS_M * cosLat) / DEG;
			points.push({ lat: origin.lat + dLat, lng: origin.lng + dLng });
		}
	}
	return points;
}
