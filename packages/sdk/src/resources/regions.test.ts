import { describe, expect, it, vi } from "vitest";
import { createRegions } from "./regions.ts";

function fakeRequest() {
	return vi.fn((_opts: unknown): Promise<unknown> => Promise.resolve({}));
}

describe("regions resource", () => {
	it("classify issues a GET with lat/lng/layers", () => {
		const request = fakeRequest();
		const regions = createRegions(request as never);
		regions.classify({ lat: -37.8136, lng: 144.9631, layers: "sa2,lga" });
		expect(request).toHaveBeenCalledWith({
			method: "GET",
			path: "/api/v1/regions",
			query: { lat: -37.8136, lng: 144.9631, layers: "sa2,lga" },
		});
	});

	it("classify omits layers when not provided (passes undefined)", () => {
		const request = fakeRequest();
		const regions = createRegions(request as never);
		regions.classify({ lat: 0, lng: 0 });
		expect(request).toHaveBeenCalledWith({
			method: "GET",
			path: "/api/v1/regions",
			query: { lat: 0, lng: 0, layers: undefined },
		});
	});
});
