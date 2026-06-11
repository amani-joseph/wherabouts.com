import { describe, expect, it } from "vitest";
import {
	fetchOsrmRoute,
	fetchOsrmTable,
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
