import { describe, expect, it } from "vitest";
import { apiExplorerEndpoints } from "@/lib/api-explorer-endpoints";
import {
	capabilities,
	exampleParamsForEndpoint,
	featuredEndpointIds,
} from "@/lib/landing-content";

const catalogIds = new Set(apiExplorerEndpoints.map((e) => e.id));

describe("landing-content", () => {
	it("exposes exactly seven capability cards", () => {
		expect(capabilities).toHaveLength(7);
		const ids = capabilities.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("every capability references real catalog endpoint ids", () => {
		for (const card of capabilities) {
			expect(card.endpointIds.length).toBeGreaterThan(0);
			for (const id of card.endpointIds) {
				expect(catalogIds.has(id)).toBe(true);
			}
		}
	});

	it("every featured endpoint id exists in the catalog", () => {
		for (const id of featuredEndpointIds) {
			expect(catalogIds.has(id)).toBe(true);
		}
	});

	it("derives example params from the catalog for a featured endpoint", () => {
		const params = exampleParamsForEndpoint("addresses.autocomplete");
		expect(params.q).toBeDefined();
	});
});
