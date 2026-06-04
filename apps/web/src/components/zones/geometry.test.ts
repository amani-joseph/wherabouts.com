import { describe, expect, it } from "vitest";
import { closeRing, featureToPolygon, type DrawFeature } from "./geometry.ts";

const openRing: [number, number][] = [
	[151.2, -33.8],
	[151.3, -33.8],
	[151.3, -33.9],
	[151.2, -33.9],
];
const closedRing: [number, number][] = [...openRing, [151.2, -33.8]];

describe("closeRing", () => {
	it("appends the first coord when the ring is open", () => {
		expect(closeRing(openRing)).toEqual(closedRing);
	});
	it("leaves an already-closed ring unchanged", () => {
		expect(closeRing(closedRing)).toEqual(closedRing);
	});
});

describe("featureToPolygon", () => {
	it("extracts a closed Polygon from a terra-draw Feature", () => {
		const feature: DrawFeature = {
			type: "Feature",
			properties: {},
			geometry: { type: "Polygon", coordinates: [closedRing] },
		};
		expect(featureToPolygon(feature)).toEqual({
			type: "Polygon",
			coordinates: [closedRing],
		});
	});
	it("closes an open ring coming from the draw tool", () => {
		const feature: DrawFeature = {
			type: "Feature",
			properties: {},
			geometry: { type: "Polygon", coordinates: [openRing] },
		};
		expect(featureToPolygon(feature)).toEqual({
			type: "Polygon",
			coordinates: [closedRing],
		});
	});
	it("returns null for a non-polygon feature", () => {
		const feature = {
			type: "Feature",
			properties: {},
			geometry: { type: "Point", coordinates: [151.2, -33.8] },
		} as unknown as DrawFeature;
		expect(featureToPolygon(feature)).toBeNull();
	});
});
