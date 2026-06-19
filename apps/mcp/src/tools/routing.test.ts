import { describe, expect, it, vi } from "vitest";
import { routingTools } from "./routing.ts";

const tool = (name: string) => {
	const t = routingTools.find((x) => x.name === name);
	if (!t) {
		throw new Error(`missing tool ${name}`);
	}
	return t;
};

describe("routing tools", () => {
	it("registers the five expected tools, all read-only", () => {
		expect(routingTools.map((t) => t.name).sort()).toEqual([
			"get_directions",
			"isochrone",
			"match_trace",
			"optimize_stops",
			"travel_matrix",
		]);
		for (const t of routingTools) {
			expect(t.annotations?.readOnlyHint).toBe(true);
		}
	});

	it("get_directions calls routing.directions", async () => {
		const directions = vi.fn(async () => ({ routes: [] }));
		const client = { routing: { directions } } as any;
		await tool("get_directions").handler(client, { from: "a", to: "b" });
		expect(directions).toHaveBeenCalledWith({ from: "a", to: "b" });
	});

	it("travel_matrix calls routing.matrix", async () => {
		const matrix = vi.fn(async () => ({ durations: [] }));
		const client = { routing: { matrix } } as any;
		await tool("travel_matrix").handler(client, {
			sources: "x",
			destinations: "y",
		});
		expect(matrix).toHaveBeenCalledWith({ sources: "x", destinations: "y" });
	});

	it("isochrone calls routing.isochrone", async () => {
		const isochrone = vi.fn(async () => ({ polygon: {}, query: {} }));
		const client = { routing: { isochrone } } as any;
		await tool("isochrone").handler(client, {
			origin: "-33.87,151.21",
			durationSeconds: 900,
		});
		expect(isochrone).toHaveBeenCalledWith({
			origin: "-33.87,151.21",
			durationSeconds: 900,
		});
	});

	it("match_trace calls routing.match with widened MatchPoint schema", async () => {
		const match = vi.fn(async () => ({ matchings: [], tracepoints: [] }));
		const client = { routing: { match } } as any;
		const coords = [
			{ lat: -33.87, lng: 151.21, radius: 5, timestamp: 1_700_000_000 },
			{ lat: -33.88, lng: 151.22 },
		];
		await tool("match_trace").handler(client, { coordinates: coords });
		expect(match).toHaveBeenCalledWith({ coordinates: coords });
	});

	it("optimize_stops calls routing.optimize with widened OptimizeWaypoint schema", async () => {
		const optimize = vi.fn(async () => ({ trips: [], waypoints: [] }));
		const client = { routing: { optimize } } as any;
		const waypoints = [{ lat: -33.87, lng: 151.21 }, { addressId: 42 }];
		await tool("optimize_stops").handler(client, {
			waypoints,
			roundtrip: true,
		});
		expect(optimize).toHaveBeenCalledWith({ waypoints, roundtrip: true });
	});

	it("optimize_stops forwards source and destination enums", async () => {
		const optimize = vi.fn(async () => ({ trips: [], waypoints: [] }));
		const client = { routing: { optimize } } as any;
		const waypoints = [{ lat: -33.87, lng: 151.21 }, { addressId: 42 }];
		await tool("optimize_stops").handler(client, {
			waypoints,
			source: "first",
			destination: "last",
		});
		expect(optimize).toHaveBeenCalledWith({
			waypoints,
			source: "first",
			destination: "last",
		});
	});
});
