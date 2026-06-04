import { describe, expect, it } from "vitest";
import { geoJsonPolygonSchema } from "./zones-schema.ts";

describe("geoJsonPolygonSchema", () => {
	it("accepts a valid closed polygon", () => {
		const result = geoJsonPolygonSchema.safeParse({
			type: "Polygon",
			coordinates: [
				[
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 1],
					[0, 0],
				],
			],
		});
		expect(result.success).toBe(true);
	});

	it("rejects non-Polygon type", () => {
		const result = geoJsonPolygonSchema.safeParse({
			type: "LineString",
			coordinates: [
				[
					[0, 0],
					[1, 1],
				],
			],
		});
		expect(result.success).toBe(false);
	});

	it("rejects empty coordinates array", () => {
		const result = geoJsonPolygonSchema.safeParse({
			type: "Polygon",
			coordinates: [],
		});
		expect(result.success).toBe(false);
	});
});
