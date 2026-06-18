import { describe, expect, it } from "vitest";
import { parseFreeformAddress } from "./parse-freeform-address.ts";
import { buildAnchorPrefixes } from "./structured-search.ts";

describe("buildAnchorPrefixes", () => {
	it("builds full-street then broad tiers", () => {
		const parsed = parseFreeformAddress(
			"1 Rocket Road, Hawthorne, CA 90250, US"
		);
		expect(buildAnchorPrefixes(parsed)).toEqual([
			["1 ROCKET ROAD"],
			["1 ROCKET"],
		]);
	});

	it("collapses to one tier for a single-token street", () => {
		const parsed = parseFreeformAddress("1 Broadway, New York, NY, US");
		expect(buildAnchorPrefixes(parsed)).toEqual([["1 BROADWAY"]]);
	});

	it("expands a leading directional into <=2 variants per tier", () => {
		const parsed = parseFreeformAddress(
			"1 N Rocket Rd, Hawthorne, CA 90250, US"
		);
		expect(buildAnchorPrefixes(parsed)).toEqual([
			["1 N ROCKET RD", "1 NORTH ROCKET RD"],
			["1 N ROCKET", "1 NORTH ROCKET"],
		]);
	});

	it("returns [] when there is no house number", () => {
		const parsed = parseFreeformAddress("Rocket Road, Hawthorne, CA, US");
		expect(buildAnchorPrefixes(parsed)).toEqual([]);
	});

	it("returns [] when there are no street tokens", () => {
		const parsed = parseFreeformAddress("90250, US");
		expect(buildAnchorPrefixes(parsed)).toEqual([]);
	});
});
