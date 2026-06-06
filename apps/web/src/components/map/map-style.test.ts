import { describe, expect, it } from "vitest";
import { buildMapStyle, OPENFREEMAP_DARK } from "./map-style.ts";

describe("buildMapStyle", () => {
	it("falls back to OpenFreeMap dark when no tiles base url", () => {
		expect(buildMapStyle(undefined)).toBe(OPENFREEMAP_DARK);
	});

	it("builds a Protomaps style object pointing at our tile worker", () => {
		const style = buildMapStyle("https://api.wherabouts.com");
		expect(typeof style).not.toBe("string");
		const s = style as Exclude<ReturnType<typeof buildMapStyle>, string>;
		expect(s.sources.protomaps).toMatchObject({
			type: "vector",
			tiles: ["https://api.wherabouts.com/tiles/v1/{z}/{x}/{y}.mvt"],
		});
		expect(s.glyphs).toBe(
			"https://api.wherabouts.com/tiles/v1/fonts/{fontstack}/{range}.pbf"
		);
		expect(Array.isArray(s.layers)).toBe(true);
		expect(s.layers.length).toBeGreaterThan(5);
	});
});
