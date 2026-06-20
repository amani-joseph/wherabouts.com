import { describe, expect, it } from "vitest";
import { countryName, distanceMeters, getLatLng, toLngLat } from "./geo.ts";

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

describe("countryName", () => {
	it("resolves ISO codes to English display names", () => {
		expect(countryName("AU")).toBe("Australia");
		expect(countryName("US")).toBe("United States");
		expect(countryName("IS")).toBe("Iceland");
	});

	it("is case-insensitive", () => {
		expect(countryName("gb")).toBe("United Kingdom");
	});

	it("falls back to the raw value for malformed codes", () => {
		expect(countryName("ZZZ")).toBe("ZZZ");
		expect(countryName("")).toBe("");
	});

	it("supports a localized name via the locale argument", () => {
		expect(countryName("DE", "de")).toBe("Deutschland");
	});
});
