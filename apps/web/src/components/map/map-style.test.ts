import { describe, expect, it } from "vitest";
import { buildMapStyleUrl, OPENFREEMAP_DARK } from "./map-style.ts";

describe("buildMapStyleUrl", () => {
	it("builds a MapTiler dark style URL with the key", () => {
		expect(buildMapStyleUrl("abc123")).toBe(
			"https://api.maptiler.com/maps/streets-v2-dark/style.json?key=abc123"
		);
	});

	it("returns the OpenFreeMap dark style when key is missing", () => {
		expect(buildMapStyleUrl(undefined)).toBe(OPENFREEMAP_DARK);
	});

	it("returns the OpenFreeMap dark style when key is an empty string", () => {
		expect(buildMapStyleUrl("")).toBe(OPENFREEMAP_DARK);
	});
});
