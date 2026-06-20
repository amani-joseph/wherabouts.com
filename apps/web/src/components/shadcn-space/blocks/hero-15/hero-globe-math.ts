/**
 * Rotation maths for the cobe hero globe. Kept DOM/WebGL-free so the mapping
 * from a geocoded coordinate to the globe's `phi`/`theta` can be unit-tested.
 */

const DEG_TO_RAD = Math.PI / 180;
const HALF_PI = Math.PI / 2;

/**
 * Maximum vertical tilt (radians). Kept just under π/2 so flying to a polar
 * coordinate never rotates the globe past its pole and flips the view.
 */
export const GLOBE_MAX_TILT = 1.2;

export interface GlobeRotation {
	/** Horizontal rotation (longitude) in radians. */
	phi: number;
	/** Vertical tilt (latitude) in radians. */
	theta: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Convert a latitude/longitude pair into the `phi`/`theta` cobe expects to
 * bring that point to face the viewer. Uses cobe's canonical focus formula
 * (`phi = 3π/2 − lng`, `theta = lat`), with the tilt clamped near the poles.
 */
export function latLngToRotation(lat: number, lng: number): GlobeRotation {
	const phi = Math.PI - (lng * DEG_TO_RAD - HALF_PI);
	const theta = clamp(lat * DEG_TO_RAD, -GLOBE_MAX_TILT, GLOBE_MAX_TILT);
	return { phi, theta };
}
