import { describe, expect, it } from "vitest";
import { generateSamplePoints, ISO_SAMPLE_COUNT } from "./isochrone-queries.ts";

const ORIGIN = { lat: -37.8136, lng: 144.9631 };

describe("generateSamplePoints", () => {
	it("produces ISO_SAMPLE_COUNT points, all distinct", () => {
		const pts = generateSamplePoints(ORIGIN, { maxRadiusMeters: 5000 });
		expect(pts).toHaveLength(ISO_SAMPLE_COUNT);
		const keys = new Set(pts.map((p) => `${p.lat},${p.lng}`));
		expect(keys.size).toBe(ISO_SAMPLE_COUNT);
	});

	it("keeps origin + samples within the OSRM /table cap of 100", () => {
		const total = 1 + ISO_SAMPLE_COUNT;
		expect(total).toBeLessThanOrEqual(100);
	});

	it("places the outermost ring near maxRadiusMeters from the origin", () => {
		const maxRadiusMeters = 10_000;
		const pts = generateSamplePoints(ORIGIN, { maxRadiusMeters });
		// Bearing 0 of the outermost step heads due north by ~maxRadiusMeters.
		const outerNorth = pts.at(-12);
		const dLatDeg = (maxRadiusMeters / 6_371_000) * (180 / Math.PI);
		expect(outerNorth?.lat).toBeCloseTo(ORIGIN.lat + dLatDeg, 4);
		expect(outerNorth?.lng).toBeCloseTo(ORIGIN.lng, 4);
	});

	it("spreads bearings around the origin (points on both sides)", () => {
		const pts = generateSamplePoints(ORIGIN, { maxRadiusMeters: 5000 });
		expect(pts.some((p) => p.lng > ORIGIN.lng)).toBe(true);
		expect(pts.some((p) => p.lng < ORIGIN.lng)).toBe(true);
		expect(pts.some((p) => p.lat > ORIGIN.lat)).toBe(true);
		expect(pts.some((p) => p.lat < ORIGIN.lat)).toBe(true);
	});
});
