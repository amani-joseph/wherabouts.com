import { describe, expect, it } from "vitest";
import { sceneFromInputs } from "./scene-builders.ts";

describe("sceneFromInputs", () => {
	it("routing.directions: two markers in [lng,lat] order", () => {
		const scene = sceneFromInputs("routing.directions", {
			from: "-27.47,153.02",
			to: "-33.87,151.21",
		});
		expect(scene.features).toEqual([
			{ kind: "marker", lngLat: [153.02, -27.47], label: "from", role: "from" },
			{ kind: "marker", lngLat: [151.21, -33.87], label: "to", role: "to" },
		]);
	});

	it("routing.directions: skips a field that is not a coordinate", () => {
		const scene = sceneFromInputs("routing.directions", {
			from: "Brisbane",
			to: "-33.87,151.21",
		});
		expect(scene.features).toEqual([
			{ kind: "marker", lngLat: [151.21, -33.87], label: "to", role: "to" },
		]);
	});

	it("addresses.nearby: center marker + radius circle", () => {
		const scene = sceneFromInputs("addresses.nearby", {
			lat: "-37.81",
			lng: "144.96",
			radius: "500",
		});
		expect(scene.features).toEqual([
			{
				kind: "marker",
				lngLat: [144.96, -37.81],
				label: "center",
				role: "center",
			},
			{ kind: "circle", center: [144.96, -37.81], radiusM: 500 },
		]);
	});

	it("addresses.reverse: single point marker", () => {
		const scene = sceneFromInputs("addresses.reverse", {
			lat: "-37.81",
			lng: "144.96",
		});
		expect(scene.features).toEqual([
			{
				kind: "marker",
				lngLat: [144.96, -37.81],
				label: "point",
				role: "point",
			},
		]);
	});

	it("non-geo method: empty scene", () => {
		expect(sceneFromInputs("webhooks.create", {}).features).toEqual([]);
	});
});
