import { describe, expect, it, vi } from "vitest";
import { createAddresses } from "./addresses.ts";

function fakeRequest() {
	const calls: unknown[] = [];
	const request = vi.fn((opts: unknown) => {
		calls.push(opts);
		return {} as never;
	});
	return { request, calls };
}

describe("addresses resource", () => {
	it("autocomplete issues a GET with q/country/state/limit", async () => {
		const { request } = fakeRequest();
		const addresses = createAddresses(request as never);
		await addresses.autocomplete({ q: "123 Main", limit: 5 });
		expect(request).toHaveBeenCalledWith({
			method: "GET",
			path: "/api/v1/addresses/autocomplete",
			query: { q: "123 Main", country: undefined, state: undefined, limit: 5 },
		});
	});

	it("getById interpolates the id into the path", async () => {
		const { request } = fakeRequest();
		const addresses = createAddresses(request as never);
		await addresses.getById(42);
		expect(request).toHaveBeenCalledWith({
			method: "GET",
			path: "/api/v1/addresses/42",
		});
	});

	it("reverse and nearby issue GETs with coordinates", async () => {
		const { request } = fakeRequest();
		const addresses = createAddresses(request as never);
		await addresses.reverse({ lat: -37.8, lng: 144.9 });
		await addresses.nearby({ lat: -37.8, lng: 144.9, radius: 500 });
		expect(request).toHaveBeenNthCalledWith(1, {
			method: "GET",
			path: "/api/v1/addresses/reverse",
			query: { lat: -37.8, lng: 144.9 },
		});
		expect(request).toHaveBeenNthCalledWith(2, {
			method: "GET",
			path: "/api/v1/addresses/nearby",
			query: {
				lat: -37.8,
				lng: 144.9,
				radius: 500,
				limit: undefined,
				country: undefined,
			},
		});
	});
});
