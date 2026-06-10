import { describe, expect, it } from "vitest";
import { sceneFromInputs, sceneFromResult } from "./scene-builders.ts";

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

describe("sceneFromResult", () => {
	it("routing.directions: line + from/to markers from query", () => {
		const scene = sceneFromResult("routing.directions", {
			query: {
				from: { lat: -27.47, lng: 153.02 },
				to: { lat: -33.87, lng: 151.21 },
			},
			geometry: {
				type: "LineString",
				coordinates: [
					[153.02, -27.47],
					[151.21, -33.87],
				],
			},
		});
		expect(scene.features).toEqual([
			{
				kind: "line",
				coordinates: [
					[153.02, -27.47],
					[151.21, -33.87],
				],
			},
			{ kind: "marker", lngLat: [153.02, -27.47], label: "from", role: "from" },
			{ kind: "marker", lngLat: [151.21, -33.87], label: "to", role: "to" },
		]);
	});

	it("addresses.geocode: single result marker", () => {
		const scene = sceneFromResult("addresses.geocode", {
			address: { latitude: -37.81, longitude: 144.96 },
		});
		expect(scene.features).toEqual([
			{
				kind: "marker",
				lngLat: [144.96, -37.81],
				label: "result",
				role: "result",
			},
		]);
	});

	it("addresses.nearby: one marker per result", () => {
		const scene = sceneFromResult("addresses.nearby", {
			results: [
				{ latitude: -37.81, longitude: 144.96 },
				{ latitude: -37.82, longitude: 144.97 },
			],
		});
		expect(scene.features).toHaveLength(2);
		expect(scene.features[0]).toEqual({
			kind: "marker",
			lngLat: [144.96, -37.81],
			label: "result",
			role: "result",
		});
	});

	it("zones.list: one polygon per zone", () => {
		const scene = sceneFromResult("zones.list", {
			zones: [
				{
					geometry: {
						type: "Polygon",
						coordinates: [
							[
								[0, 0],
								[1, 0],
								[1, 1],
								[0, 0],
							],
						],
					},
				},
			],
		});
		expect(scene.features).toEqual([
			{
				kind: "polygon",
				rings: [
					[
						[0, 0],
						[1, 0],
						[1, 1],
						[0, 0],
					],
				],
			},
		]);
	});

	it("addresses.byId: marker from top-level lat/lng", () => {
		const scene = sceneFromResult("addresses.byId", {
			latitude: -37.81,
			longitude: 144.96,
		});
		expect(scene.features).toEqual([
			{
				kind: "marker",
				lngLat: [144.96, -37.81],
				label: "result",
				role: "result",
			},
		]);
	});

	it("error body: empty scene", () => {
		const scene = sceneFromResult("addresses.geocode", {
			error: { code: "not_found", message: "No address" },
		});
		expect(scene.features).toEqual([]);
	});

	it("unknown shape: empty scene", () => {
		expect(sceneFromResult("addresses.geocode", null).features).toEqual([]);
	});
});
