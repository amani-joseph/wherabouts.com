import { describe, expect, it, vi } from "vitest";
import { geocodingTools } from "./geocoding.ts";

const tool = (name: string) => {
	const t = geocodingTools.find((x) => x.name === name);
	if (!t) {
		throw new Error(`missing tool ${name}`);
	}
	return t;
};

describe("geocoding tools", () => {
	it("registers the five expected tools, all read-only", () => {
		expect(geocodingTools.map((t) => t.name).sort()).toEqual([
			"autocomplete_address",
			"classify_region",
			"geocode_address",
			"nearby_addresses",
			"reverse_geocode",
		]);
		for (const t of geocodingTools) {
			expect(t.annotations?.readOnlyHint).toBe(true);
		}
	});

	it("geocode_address calls geocode.forward and returns JSON", async () => {
		const forward = vi.fn(async () => ({ candidates: [{ id: 1 }] }));
		const client = { geocode: { forward } } as any;
		const res = await tool("geocode_address").handler(client, {
			q: "1 Main St",
		});
		expect(forward).toHaveBeenCalledWith({ q: "1 Main St" });
		// biome-ignore lint/style/noNonNullAssertion: content always has at least one item
		expect(res.content[0]!.text).toContain('"candidates"');
	});

	it("reverse_geocode calls addresses.reverse with lat/lng", async () => {
		const reverse = vi.fn(async () => ({ address: "x" }));
		const client = { addresses: { reverse } } as any;
		await tool("reverse_geocode").handler(client, { lat: -33.8, lng: 151.2 });
		expect(reverse).toHaveBeenCalledWith({ lat: -33.8, lng: 151.2 });
	});

	it("autocomplete_address calls addresses.autocomplete", async () => {
		const autocomplete = vi.fn(async () => ({ count: 0, results: [] }));
		const client = { addresses: { autocomplete } } as any;
		await tool("autocomplete_address").handler(client, { q: "1 Ma" });
		expect(autocomplete).toHaveBeenCalledWith({ q: "1 Ma" });
	});

	it("nearby_addresses calls addresses.nearby", async () => {
		const nearby = vi.fn(async () => ({ count: 0, results: [] }));
		const client = { addresses: { nearby } } as any;
		await tool("nearby_addresses").handler(client, { lat: -33.8, lng: 151.2 });
		expect(nearby).toHaveBeenCalledWith({ lat: -33.8, lng: 151.2 });
	});

	it("classify_region calls regions.classify", async () => {
		const classify = vi.fn(async () => ({ matches: [] }));
		const client = { regions: { classify } } as any;
		await tool("classify_region").handler(client, { lat: -33.8, lng: 151.2 });
		expect(classify).toHaveBeenCalledWith({ lat: -33.8, lng: 151.2 });
	});
});
