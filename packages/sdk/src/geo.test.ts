import { describe, expect, it } from "vitest";
import { distanceMeters, getLatLng, toLngLat } from "./geo.ts";

const melbourne = { latitude: -37.8136, longitude: 144.9631 };
const sydney = { latitude: -33.8688, longitude: 151.2093 };

describe("getLatLng", () => {
	it("maps latitude/longitude to { lat, lng }", () => {
		expect(getLatLng(melbourne)).toEqual({ lat: -37.8136, lng: 144.9631 });
	});
});

describe("toLngLat", () => {
	it("returns GeoJSON [lng, lat] order", () => {
		expect(toLngLat(melbourne)).toEqual([144.9631, -37.8136]);
	});
});

describe("distanceMeters", () => {
	it("computes the great-circle distance (Melbourne→Sydney ≈ 714km)", () => {
		const d = distanceMeters(melbourne, sydney);
		// Haversine straight-line is ~713–714 km; allow a small tolerance.
		expect(d).toBeGreaterThan(710_000);
		expect(d).toBeLessThan(718_000);
	});

	it("is zero for the same point", () => {
		expect(distanceMeters(melbourne, melbourne)).toBe(0);
	});
});
