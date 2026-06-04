import { describe, expect, it } from "vitest";
import { buildMapStyleUrl, FALLBACK_STYLE } from "./map-style.ts";

describe("buildMapStyleUrl", () => {
	it("builds a MapTiler streets style URL with the key", () => {
		expect(buildMapStyleUrl("abc123")).toBe(
			"https://api.maptiler.com/maps/streets-v2/style.json?key=abc123"
		);
	});

	it("returns the fallback raster-OSM style object when key is missing", () => {
		expect(buildMapStyleUrl(undefined)).toEqual(FALLBACK_STYLE);
	});

	it("returns the fallback when key is an empty string", () => {
		expect(buildMapStyleUrl("")).toEqual(FALLBACK_STYLE);
	});
});
