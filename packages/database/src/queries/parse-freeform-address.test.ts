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
});
