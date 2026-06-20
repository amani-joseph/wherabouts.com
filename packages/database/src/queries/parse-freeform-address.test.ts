import { describe, expect, it } from "vitest";
import { parseFreeformAddress } from "./parse-freeform-address.ts";

describe("parseFreeformAddress", () => {
	it("parses a full US address", () => {
		const r = parseFreeformAddress(
			"1 Rocket Road, Hawthorne, CA 90250, United States"
		);
		expect(r.houseNumber).toBe("1");
		expect(r.directional).toBeNull();
		expect(r.streetTokens).toEqual(["ROCKET", "ROAD"]);
		expect(r.locality).toBe("HAWTHORNE");
		expect(r.region).toBe("CA");
		expect(r.postcode).toBe("90250");
		expect(r.countryCode).toBe("US");
		expect(r.confidence).toBe("high");
	});

	it("captures a leading directional", () => {
		const r = parseFreeformAddress("1 N Rocket Rd, Hawthorne, CA 90250, US");
		expect(r.houseNumber).toBe("1");
		expect(r.directional).toBe("N");
		expect(r.streetTokens).toEqual(["ROCKET", "RD"]);
	});

	it("parses a UK postcode", () => {
		const r = parseFreeformAddress("10 Downing St, London, SW1A 2AA, UK");
		expect(r.houseNumber).toBe("10");
		expect(r.postcode).toBe("SW1A 2AA");
		expect(r.countryCode).toBe("GB");
		expect(r.locality).toBe("LONDON");
	});

	it("parses an AU address", () => {
		const r = parseFreeformAddress("120 Main St, Sydney, NSW 2000, Australia");
		expect(r.region).toBe("NSW");
		expect(r.postcode).toBe("2000");
		expect(r.countryCode).toBe("AU");
	});

	it("builds a cleaned string in stored order without commas or country name", () => {
		const r = parseFreeformAddress(
			"1 Rocket Road, Hawthorne, CA 90250, United States"
		);
		expect(r.cleaned).toBe("1 ROCKET ROAD HAWTHORNE CA 90250");
	});

	it("marks bare typeahead as low confidence", () => {
		const r = parseFreeformAddress("120 Mai");
		expect(r.confidence).toBe("low");
		expect(r.countryCode).toBeNull();
		expect(r.postcode).toBeNull();
	});

	it("handles missing house number", () => {
		const r = parseFreeformAddress("Rocket Road, Hawthorne, CA, US");
		expect(r.houseNumber).toBeNull();
		expect(r.countryCode).toBe("US");
	});

	it("handles a house-number range", () => {
		const r = parseFreeformAddress("1-3 Rocket Road, Hawthorne, CA 90250, US");
		expect(r.houseNumber).toBe("1-3");
		expect(r.streetTokens).toEqual(["ROCKET", "ROAD"]);
	});

	it("parses a Canadian address with full postcode and province", () => {
		const r = parseFreeformAddress("150 Elgin St, Ottawa, ON K1A 0B1, Canada");
		expect(r.houseNumber).toBe("150");
		expect(r.region).toBe("ON");
		expect(r.postcode).toBe("K1A 0B1");
		expect(r.countryCode).toBe("CA");
		expect(r.locality).toBe("OTTAWA");
	});

	it("normalizes street-first input to number-first (Iceland convention)", () => {
		const r = parseFreeformAddress("Laugavegur 26");
		expect(r.houseNumber).toBe("26");
		expect(r.streetTokens).toEqual(["LAUGAVEGUR"]);
		expect(r.cleaned).toBe("26 LAUGAVEGUR");
		// high confidence routes it through the number-first structured path
		expect(r.confidence).toBe("high");
	});

	it("normalizes street-first within a full address", () => {
		const r = parseFreeformAddress("Laugavegur 26, Reykjavik, IS");
		expect(r.houseNumber).toBe("26");
		expect(r.streetTokens).toEqual(["LAUGAVEGUR"]);
		expect(r.locality).toBe("REYKJAVIK");
		expect(r.countryCode).toBe("IS");
		expect(r.cleaned).toBe("26 LAUGAVEGUR REYKJAVIK");
	});

	it("does not treat number-first typeahead as street-first", () => {
		const r = parseFreeformAddress("120 Mai");
		expect(r.houseNumber).toBe("120");
		expect(r.streetTokens).toEqual(["MAI"]);
		expect(r.confidence).toBe("low");
	});
});
