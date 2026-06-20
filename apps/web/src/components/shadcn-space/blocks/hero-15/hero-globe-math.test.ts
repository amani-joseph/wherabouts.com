import { describe, expect, it } from "vitest";
import {
	GLOBE_MAX_TILT,
	latLngToRotation,
} from "@/components/shadcn-space/blocks/hero-15/hero-globe-math";

const HALF_PI = Math.PI / 2;

describe("latLngToRotation", () => {
	it("maps the prime meridian / equator to cobe's baseline focus angle", () => {
		const { phi, theta } = latLngToRotation(0, 0);
		// cobe focus formula: phi = 3π/2 at lng 0, theta = 0 at the equator.
		expect(phi).toBeCloseTo(Math.PI + HALF_PI, 6);
		expect(theta).toBeCloseTo(0, 6);
	});

	it("rotates phi in the correct direction for longitude sign", () => {
		const west = latLngToRotation(0, -90).phi;
		const center = latLngToRotation(0, 0).phi;
		const east = latLngToRotation(0, 90).phi;
		// Eastward longitude decreases phi; westward increases it.
		expect(east).toBeLessThan(center);
		expect(west).toBeGreaterThan(center);
	});

	it("tilts theta toward the hemisphere of the latitude", () => {
		expect(latLngToRotation(45, 0).theta).toBeCloseTo(Math.PI / 4, 6);
		expect(latLngToRotation(-45, 0).theta).toBeCloseTo(-Math.PI / 4, 6);
	});

	it("clamps theta near the poles so the globe never flips over", () => {
		expect(latLngToRotation(90, 0).theta).toBeCloseTo(GLOBE_MAX_TILT, 6);
		expect(latLngToRotation(-90, 0).theta).toBeCloseTo(-GLOBE_MAX_TILT, 6);
		expect(GLOBE_MAX_TILT).toBeLessThan(HALF_PI);
	});

	it("returns finite angles for extreme coordinates", () => {
		for (const [lat, lng] of [
			[90, 180],
			[-90, -180],
			[0, 0],
			[51.5034, -0.1276],
		] as const) {
			const { phi, theta } = latLngToRotation(lat, lng);
			expect(Number.isFinite(phi)).toBe(true);
			expect(Number.isFinite(theta)).toBe(true);
		}
	});
});
