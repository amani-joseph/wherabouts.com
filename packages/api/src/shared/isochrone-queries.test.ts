import { describe, expect, it } from "vitest";
import {
	generateSamplePoints,
	hullPolygon,
	ISO_SAMPLE_COUNT,
	IsochroneError,
	reachablePoints,
} from "./isochrone-queries.ts";

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

describe("reachablePoints", () => {
	const coords = [
		{ lat: 0, lng: 0 }, // origin (index 0)
		{ lat: 1, lng: 1 }, // within budget
		{ lat: 2, lng: 2 }, // over budget
		{ lat: 3, lng: 3 }, // unreachable (null)
	];

	it("keeps the origin plus within-budget points, dropping over-budget and null", () => {
		const metric = [[0, 100, 500, null]];
		const result = reachablePoints(metric, coords, 200);
		expect(result).toEqual([
			{ lat: 0, lng: 0 },
			{ lat: 1, lng: 1 },
		]);
	});

	it("treats the budget as inclusive (<=)", () => {
		const metric = [[0, 200, 201, null]];
		const result = reachablePoints(metric, coords, 200);
		expect(result).toContainEqual({ lat: 1, lng: 1 });
		expect(result).not.toContainEqual({ lat: 2, lng: 2 });
	});

	it("always includes the origin even if its cell is 0", () => {
		const metric = [[0, 999, 999, 999]];
		const result = reachablePoints(metric, coords, 10);
		expect(result).toEqual([{ lat: 0, lng: 0 }]);
	});
});

describe("hullPolygon", () => {
	it("rejects with IsochroneError on a degenerate (<3) point set, without hitting the db", async () => {
		// db must never be touched on the degenerate path — make any access throw.
		const db = new Proxy(
			{},
			{
				get() {
					throw new Error("db should not be queried for <3 points");
				},
			}
		) as never;
		await expect(
			hullPolygon(db, [
				{ lat: 0, lng: 0 },
				{ lat: 1, lng: 1 },
			])
		).rejects.toBeInstanceOf(IsochroneError);
	});
});
