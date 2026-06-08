import { describe, expect, it } from "vitest";
import {
	buildProxyRequest,
	EXPLORER_ENDPOINT_IDS,
	getExplorerEndpoint,
} from "./api-explorer.ts";
import { EXPLORER_ENDPOINT_ID_LIST } from "./api-explorer-ids.ts";

describe("buildProxyRequest", () => {
	it("builds a GET url with query params, dropping empties", () => {
		const ep = getExplorerEndpoint("addresses.autocomplete");
		const out = buildProxyRequest(
			ep,
			{ q: "123 Main", country: "AU", state: "" },
			undefined
		);
		expect(out.method).toBe("GET");
		expect(out.url).toBe(
			"/api/v1/addresses/autocomplete?q=123%20Main&country=AU"
		);
		expect(out.body).toBeUndefined();
	});

	it("interpolates path params", () => {
		const ep = getExplorerEndpoint("zones.get");
		const out = buildProxyRequest(ep, { id: "7" }, undefined);
		expect(out.url).toBe("/api/v1/zones/7");
	});

	it("sends a JSON body for POST and uses the POST method", () => {
		const ep = getExplorerEndpoint("zones.create");
		const out = buildProxyRequest(ep, {}, { name: "depot" });
		expect(out.method).toBe("POST");
		expect(out.body).toEqual({ name: "depot" });
		expect(out.url).toBe("/api/v1/zones");
	});

	it("interpolates path + sends body for PUT", () => {
		const ep = getExplorerEndpoint("zones.update");
		const out = buildProxyRequest(ep, { id: "7" }, { name: "renamed" });
		expect(out.method).toBe("PUT");
		expect(out.url).toBe("/api/v1/zones/7");
		expect(out.body).toEqual({ name: "renamed" });
	});

	it("uses DELETE with no body even if one is passed", () => {
		const ep = getExplorerEndpoint("zones.delete");
		const out = buildProxyRequest(ep, { id: "7" }, undefined);
		expect(out.method).toBe("DELETE");
		expect(out.url).toBe("/api/v1/zones/7");
		expect(out.body).toBeUndefined();
	});

	it("includes regions.classify as an executable GET", () => {
		const ep = getExplorerEndpoint("regions.classify");
		const out = buildProxyRequest(
			ep,
			{ lat: "-37.8", lng: "144.9", layers: "" },
			undefined
		);
		expect(out.method).toBe("GET");
		expect(out.url).toBe("/api/v1/regions?lat=-37.8&lng=144.9");
	});
});

describe("EXPLORER_ENDPOINT_IDS drift guard", () => {
	it("contains exactly the expected executable endpoint ids", () => {
		expect([...EXPLORER_ENDPOINT_IDS].sort()).toEqual(
			[
				"addresses.autocomplete",
				"addresses.byId",
				"addresses.geocode",
				"addresses.nearby",
				"addresses.reverse",
				"devices.location.push",
				"devices.zones",
				"geocode.batch.poll",
				"geocode.batch.results",
				"geocode.batch.submit",
				"regions.classify",
				"routing.directions",
				"webhooks.create",
				"webhooks.delete",
				"webhooks.list",
				"webhooks.reactivate",
				"zones.addresses",
				"zones.contains",
				"zones.create",
				"zones.delete",
				"zones.get",
				"zones.list",
				"zones.update",
			].sort()
		);
	});

	it("keeps the dependency-free id list in sync with the proxy allowlist", () => {
		// EXPLORER_ENDPOINT_IDS is derived from the live endpointMap; the leaf
		// EXPLORER_ENDPOINT_ID_LIST is what the web drift-guard imports. They must
		// match so the web guard checks the real proxy surface.
		expect([...EXPLORER_ENDPOINT_ID_LIST].sort()).toEqual(
			[...EXPLORER_ENDPOINT_IDS].sort()
		);
	});
});
