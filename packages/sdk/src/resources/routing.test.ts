import { describe, expect, it, vi } from "vitest";
import { createRouting } from "./routing.ts";

function fakeRequest(resolved: unknown = {}) {
	return vi.fn((_opts: unknown): Promise<unknown> => Promise.resolve(resolved));
}

describe("routing resource", () => {
	it("directions issues a GET and forwards a walking profile (widened union)", () => {
		const request = fakeRequest();
		const routing = createRouting(request as never);
		routing.directions({
			from: "-37.8,144.9",
			to: "-33.8,151.2",
			profile: "walking",
		});
		expect(request).toHaveBeenCalledWith({
			method: "GET",
			path: "/api/v1/routing/directions",
			query: {
				from: "-37.8,144.9",
				to: "-33.8,151.2",
				fromAddressId: undefined,
				toAddressId: undefined,
				profile: "walking",
			},
		});
	});

	it("matrix issues a GET with sources/destinations/profile in the query", () => {
		const request = fakeRequest();
		const routing = createRouting(request as never);
		routing.matrix({
			sources: "-37.8,144.9|512",
			destinations: "-33.8,151.2",
			profile: "cycling",
		});
		expect(request).toHaveBeenCalledWith({
			method: "GET",
			path: "/api/v1/routing/matrix",
			query: {
				sources: "-37.8,144.9|512",
				destinations: "-33.8,151.2",
				profile: "cycling",
			},
		});
	});

	it("isochrone issues a GET, mapping originAddressId and stringifying includeRegions", () => {
		const request = fakeRequest();
		const routing = createRouting(request as never);
		routing.isochrone({
			originAddressId: 512,
			durationSeconds: 600,
			includeRegions: true,
			layers: "sa2,lga",
		});
		expect(request).toHaveBeenCalledWith({
			method: "GET",
			path: "/api/v1/routing/isochrone",
			query: {
				origin: "512",
				profile: undefined,
				durationSeconds: 600,
				distanceMeters: undefined,
				includeRegions: "true",
				layers: "sa2,lga",
			},
		});
	});

	it("isochrone prefers an explicit origin over originAddressId", () => {
		const request = fakeRequest();
		const routing = createRouting(request as never);
		routing.isochrone({ origin: "-37.8,144.9", originAddressId: 512 });
		expect(request).toHaveBeenCalledWith(
			expect.objectContaining({
				query: expect.objectContaining({ origin: "-37.8,144.9" }),
			})
		);
	});

	it("match issues a POST with the coordinate trace in the body", () => {
		const request = fakeRequest();
		const routing = createRouting(request as never);
		const coordinates = [
			{ lat: -37.8, lng: 144.9, timestamp: 1000 },
			{ lat: -37.81, lng: 144.97, timestamp: 1005 },
		];
		routing.match({ coordinates, profile: "driving", tidy: true });
		expect(request).toHaveBeenCalledWith({
			method: "POST",
			path: "/api/v1/routing/match",
			body: {
				profile: "driving",
				coordinates,
				gaps: undefined,
				tidy: true,
			},
		});
	});

	it("optimize issues a POST with waypoints + roundtrip in the body", () => {
		const request = fakeRequest();
		const routing = createRouting(request as never);
		const waypoints = [{ lat: -37.8, lng: 144.9 }, { addressId: 512 }];
		routing.optimize({ waypoints, roundtrip: false, destination: "last" });
		expect(request).toHaveBeenCalledWith({
			method: "POST",
			path: "/api/v1/routing/optimize",
			body: {
				profile: undefined,
				waypoints,
				roundtrip: false,
				source: undefined,
				destination: "last",
			},
		});
	});

	it("returns the resolved value unchanged to the caller", async () => {
		const payload = { query: { profile: "driving" }, durations: [[0]] };
		const request = fakeRequest(payload);
		const routing = createRouting(request as never);
		await expect(
			routing.matrix({ sources: "0,0", destinations: "1,1" })
		).resolves.toBe(payload);
	});
});
