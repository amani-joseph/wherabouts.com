import { describe, expect, it } from "vitest";
import { mapAutocompleteCandidates } from "./geocode.ts";

describe("mapAutocompleteCandidates", () => {
	it("projects only the fields the picker needs", () => {
		const out = mapAutocompleteCandidates([
			{
				id: 42,
				formattedAddress: "1 George St, Brisbane QLD 4000, AU",
				streetAddress: "1 George St",
				streetName: "George",
				streetNumber: "1",
				streetType: "St",
				locality: "Brisbane",
				state: "QLD",
				postcode: "4000",
				country: "AU",
				latitude: -27.47,
				longitude: 153.02,
			},
		]);
		expect(out).toEqual([
			{
				id: 42,
				formattedAddress: "1 George St, Brisbane QLD 4000, AU",
				locality: "Brisbane",
				state: "QLD",
				postcode: "4000",
				latitude: -27.47,
				longitude: 153.02,
			},
		]);
	});

	it("returns an empty array for no results", () => {
		expect(mapAutocompleteCandidates([])).toEqual([]);
	});
});
