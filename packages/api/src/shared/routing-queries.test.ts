import { describe, expect, it } from "vitest";
import {
	fetchOsrmMatch,
	fetchOsrmRoute,
	fetchOsrmTable,
	fetchOsrmTrip,
	parseLatLng,
	RoutingError,
} from "./routing-queries.ts";

const OSRM_OK = {
	code: "Ok",
	routes: [
		{
			distance: 878_000.4,
			duration: 33_120.7,
			geometry: {
				type: "LineString",
				coordinates: [
					[144.9631, -37.8136],
					[151.2093, -33.8688],
				],
			},
		},
	],
};

const osrmFetch = (status: number, body: unknown): typeof fetch =>
	(() =>
		Promise.resolve(
			new Response(JSON.stringify(body), {
				status,
				headers: { "content-type": "application/json" },
			})
		)) as typeof fetch;

describe("parseLatLng", () => {
	it("parses a valid 'lat,lng' string", () => {
		expect(parseLatLng("-37.8136,144.9631")).toEqual({
			lat: -37.8136,
			lng: 144.9631,
		});
	});

	it("returns null for malformed or out-of-range input", () => {
		expect(parseLatLng("not-a-coord")).toBeNull();
		expect(parseLatLng("100,200")).toBeNull();
		expect(parseLatLng("-37.8136")).toBeNull();
	});
});

describe("fetchOsrmRoute", () => {
	it("builds a lon,lat;lon,lat URL with auth header and maps the response", async () => {
		const calls: { url: string; token: string | null }[] = [];
		const fetchImpl = ((input: URL | string, init?: RequestInit) => {
			calls.push({
				url: String(input),
				token: new Headers(init?.headers).get("authorization"),
			});
			return Promise.resolve(
				new Response(JSON.stringify(OSRM_OK), {
					status: 200,
					headers: { "content-type": "application/json" },
				})
			);
		}) as typeof fetch;

		const result = await fetchOsrmRoute(
			{ lat: -37.8136, lng: 144.9631 },
			{ lat: -33.8688, lng: 151.2093 },
			{ baseUrl: "http://osrm.test", authToken: "tok", fetchImpl }
		);

		expect(calls[0]?.url).toContain(
			"/route/v1/car/144.9631,-37.8136;151.2093,-33.8688"
		);
		expect(calls[0]?.url).toContain("geometries=geojson");
		expect(calls[0]?.url).toContain("overview=full");
		expect(calls[0]?.token).toBe("Bearer tok");
		expect(result.distance_m).toBe(878_000);
		expect(result.duration_s).toBe(33_121);
		expect(result.geometry.type).toBe("LineString");
		expect(result.geometry.coordinates).toHaveLength(2);
	});

	it("uses the mapped OSRM profile in the /route URL (cycling → bike)", async () => {
		const calls: string[] = [];
		const fetchImpl = ((input: URL | string) => {
			calls.push(String(input));
			return Promise.resolve(
				new Response(JSON.stringify(OSRM_OK), {
					status: 200,
					headers: { "content-type": "application/json" },
				})
			);
		}) as typeof fetch;

		await fetchOsrmRoute(
			{ lat: -37.8136, lng: 144.9631 },
			{ lat: -33.8688, lng: 151.2093 },
			{ baseUrl: "http://osrm.test", authToken: "tok", fetchImpl },
			"cycling"
		);
		expect(calls[0]).toContain("/route/v1/bike/");
	});

	it("throws RoutingError(no_route) when OSRM returns NoRoute", async () => {
		const fetchImpl = osrmFetch(200, { code: "NoRoute", routes: [] });
		await expect(
			fetchOsrmRoute(
				{ lat: 0, lng: 0 },
				{ lat: 1, lng: 1 },
				{ baseUrl: "http://osrm.test", authToken: "t", fetchImpl }
			)
		).rejects.toMatchObject({ kind: "no_route" });
	});

	it("throws RoutingError(unavailable) on a non-200 OSRM response", async () => {
		const fetchImpl = osrmFetch(502, {});
		const err = await fetchOsrmRoute(
			{ lat: 0, lng: 0 },
			{ lat: 1, lng: 1 },
			{ baseUrl: "http://osrm.test", authToken: "t", fetchImpl }
		).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(RoutingError);
		expect((err as RoutingError).kind).toBe("unavailable");
	});
});

const TABLE_OK = {
	code: "Ok",
	durations: [
		[0, 120],
		[130, 0],
	],
	distances: [
		[0, 1500],
		[1600, 0],
	],
};

describe("fetchOsrmTable", () => {
	const pts = [
		{ lat: -37.8136, lng: 144.9631 },
		{ lat: -33.8688, lng: 151.2093 },
	];

	it("returns row-major durations/distances for a 2×2 request", async () => {
		const fetchImpl = osrmFetch(200, TABLE_OK);
		const result = await fetchOsrmTable(pts, {
			baseUrl: "http://osrm.test",
			authToken: "tok",
			fetchImpl,
			profile: "driving",
		});
		expect(result.durations).toEqual([
			[0, 120],
			[130, 0],
		]);
		expect(result.distances).toEqual([
			[0, 1500],
			[1600, 0],
		]);
		expect(result.sources).toEqual(pts);
		expect(result.destinations).toEqual(pts);
	});

	it("uses the mapped OSRM profile in the /table URL", async () => {
		const calls: string[] = [];
		const fetchImpl = ((input: URL | string) => {
			calls.push(String(input));
			return Promise.resolve(
				new Response(JSON.stringify(TABLE_OK), {
					status: 200,
					headers: { "content-type": "application/json" },
				})
			);
		}) as typeof fetch;

		await fetchOsrmTable(pts, {
			baseUrl: "http://osrm.test",
			authToken: "tok",
			fetchImpl,
			profile: "walking",
		});
		expect(calls[0]).toContain("/table/v1/foot/");
		expect(calls[0]).toContain("annotations=duration%2Cdistance");
	});

	it("throws RoutingError(unavailable) on a non-200 response", async () => {
		const fetchImpl = osrmFetch(502, {});
		const err = await fetchOsrmTable(pts, {
			baseUrl: "http://osrm.test",
			authToken: "t",
			fetchImpl,
			profile: "driving",
		}).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(RoutingError);
		expect((err as RoutingError).kind).toBe("unavailable");
	});

	it("throws RoutingError(unavailable) when code is not Ok", async () => {
		const fetchImpl = osrmFetch(200, { code: "InvalidQuery" });
		await expect(
			fetchOsrmTable(pts, {
				baseUrl: "http://osrm.test",
				authToken: "t",
				fetchImpl,
				profile: "driving",
			})
		).rejects.toMatchObject({ kind: "unavailable" });
	});
});

const MATCH_OK = {
	code: "Ok",
	matchings: [
		{
			confidence: 0.95,
			distance: 1234.6,
			duration: 90.4,
			geometry: {
				type: "LineString",
				coordinates: [
					[144.9631, -37.8136],
					[144.97, -37.81],
				],
			},
		},
	],
	tracepoints: [
		{ matchings_index: 0, waypoint_index: 0, location: [144.9631, -37.8136] },
		null,
		{ matchings_index: 0, waypoint_index: 1, location: [144.97, -37.81] },
	],
};

describe("fetchOsrmMatch", () => {
	const trace = [
		{ lat: -37.8136, lng: 144.9631 },
		{ lat: -37.8118, lng: 144.965 },
		{ lat: -37.81, lng: 144.97 },
	];

	it("returns matchings and tracepoints, preserving null outliers", async () => {
		const fetchImpl = osrmFetch(200, MATCH_OK);
		const result = await fetchOsrmMatch(trace, {
			baseUrl: "http://osrm.test",
			authToken: "tok",
			fetchImpl,
			profile: "driving",
		});
		expect(result.matchings).toHaveLength(1);
		expect(result.matchings[0]).toMatchObject({
			confidence: 0.95,
			distance_m: 1235,
			duration_s: 90,
		});
		expect(result.tracepoints).toHaveLength(3);
		expect(result.tracepoints[1]).toBeNull();
	});

	it("forwards profile, radiuses and timestamps in the /match URL", async () => {
		const calls: string[] = [];
		const fetchImpl = ((input: URL | string) => {
			calls.push(String(input));
			return Promise.resolve(
				new Response(JSON.stringify(MATCH_OK), {
					status: 200,
					headers: { "content-type": "application/json" },
				})
			);
		}) as typeof fetch;

		await fetchOsrmMatch(trace, {
			baseUrl: "http://osrm.test",
			authToken: "tok",
			fetchImpl,
			profile: "driving",
			radiuses: [5, 5, 8],
			timestamps: [1000, 1005, 1012],
		});
		expect(calls[0]).toContain("/match/v1/car/");
		expect(calls[0]).toContain("radiuses=5%3B5%3B8");
		expect(calls[0]).toContain("timestamps=1000%3B1005%3B1012");
	});

	it("throws RoutingError(no_match) on a NoMatch response", async () => {
		const fetchImpl = osrmFetch(200, { code: "NoMatch" });
		await expect(
			fetchOsrmMatch(trace, {
				baseUrl: "http://osrm.test",
				authToken: "t",
				fetchImpl,
				profile: "driving",
			})
		).rejects.toMatchObject({ kind: "no_match" });
	});

	it("throws RoutingError(unavailable) on a non-200 response", async () => {
		const fetchImpl = osrmFetch(500, {});
		await expect(
			fetchOsrmMatch(trace, {
				baseUrl: "http://osrm.test",
				authToken: "t",
				fetchImpl,
				profile: "driving",
			})
		).rejects.toMatchObject({ kind: "unavailable" });
	});
});

const TRIP_OK = {
	code: "Ok",
	trips: [
		{
			distance: 4567.8,
			duration: 320.4,
			geometry: {
				type: "LineString",
				coordinates: [
					[144.9631, -37.8136],
					[144.97, -37.81],
				],
			},
		},
	],
	waypoints: [
		{ waypoint_index: 0, trips_index: 0, location: [144.9631, -37.8136] },
		{ waypoint_index: 2, trips_index: 0, location: [144.97, -37.81] },
		{ waypoint_index: 1, trips_index: 0, location: [144.98, -37.8] },
	],
};

describe("fetchOsrmTrip", () => {
	const stops = [
		{ lat: -37.8136, lng: 144.9631 },
		{ lat: -37.81, lng: 144.97 },
		{ lat: -37.8, lng: 144.98 },
	];

	it("returns trips plus per-waypoint visiting order", async () => {
		const fetchImpl = osrmFetch(200, TRIP_OK);
		const result = await fetchOsrmTrip(stops, {
			baseUrl: "http://osrm.test",
			authToken: "tok",
			fetchImpl,
			profile: "driving",
		});
		expect(result.trips[0]).toMatchObject({
			distance_m: 4568,
			duration_s: 320,
		});
		expect(result.waypoints.map((w) => w.waypoint_index)).toEqual([0, 2, 1]);
	});

	it("forwards profile and roundtrip=false (with a fixed end) in the URL", async () => {
		const calls: string[] = [];
		const fetchImpl = ((input: URL | string) => {
			calls.push(String(input));
			return Promise.resolve(
				new Response(JSON.stringify(TRIP_OK), {
					status: 200,
					headers: { "content-type": "application/json" },
				})
			);
		}) as typeof fetch;

		await fetchOsrmTrip(stops, {
			baseUrl: "http://osrm.test",
			authToken: "tok",
			fetchImpl,
			profile: "driving",
			roundtrip: false,
			source: "first",
			destination: "last",
		});
		expect(calls[0]).toContain("/trip/v1/car/");
		expect(calls[0]).toContain("roundtrip=false");
		expect(calls[0]).toContain("source=first");
	});

	it("rejects an open trip with no fixed end before calling OSRM", async () => {
		let called = false;
		const fetchImpl = (() => {
			called = true;
			return Promise.resolve(new Response("{}"));
		}) as typeof fetch;
		await expect(
			fetchOsrmTrip(stops, {
				baseUrl: "http://osrm.test",
				authToken: "t",
				fetchImpl,
				profile: "driving",
				roundtrip: false,
			})
		).rejects.toMatchObject({ kind: "no_trip" });
		expect(called).toBe(false);
	});

	it("maps NoTrip and NotImplemented to RoutingError(no_trip)", async () => {
		for (const code of ["NoTrip", "NotImplemented"]) {
			const fetchImpl = osrmFetch(200, { code });
			await expect(
				fetchOsrmTrip(stops, {
					baseUrl: "http://osrm.test",
					authToken: "t",
					fetchImpl,
					profile: "driving",
				})
			).rejects.toMatchObject({ kind: "no_trip" });
		}
	});

	it("throws RoutingError(unavailable) on a non-200 response", async () => {
		const fetchImpl = osrmFetch(503, {});
		await expect(
			fetchOsrmTrip(stops, {
				baseUrl: "http://osrm.test",
				authToken: "t",
				fetchImpl,
				profile: "driving",
			})
		).rejects.toMatchObject({ kind: "unavailable" });
	});
});
