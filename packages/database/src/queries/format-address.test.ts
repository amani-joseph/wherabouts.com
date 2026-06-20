import { describe, expect, it } from "vitest";
import { formatAddress } from "./format-address.ts";

describe("formatAddress", () => {
	it("formats a stateful AU address with all parts present", () => {
		expect(
			formatAddress("123 Main St", {
				locality: "Melbourne",
				state: "VIC",
				postcode: "3000",
				country: "AU",
			})
		).toBe("123 Main St, Melbourne VIC 3000, AU");
	});

	it("formats a stateful US address", () => {
		expect(
			formatAddress("1600 Amphitheatre Pkwy", {
				locality: "Mountain View",
				state: "CA",
				postcode: "94043",
				country: "US",
			})
		).toBe("1600 Amphitheatre Pkwy, Mountain View CA 94043, US");
	});

	it("omits empty state for stateless countries without double spaces", () => {
		expect(
			formatAddress("1 Reykjanesvitabraut", {
				locality: "Reykjanesbær",
				state: "",
				postcode: "233",
				country: "IS",
			})
		).toBe("1 Reykjanesvitabraut, Reykjanesbær 233, IS");
	});

	it("handles null state the same as empty state", () => {
		expect(
			formatAddress("221B Baker St", {
				locality: "London",
				state: null,
				postcode: "NW1 6XE",
				country: "GB",
			})
		).toBe("221B Baker St, London NW1 6XE, GB");
	});

	it("drops a missing postcode without a trailing space", () => {
		expect(
			formatAddress("10 Rue de Rivoli", {
				locality: "Paris",
				state: "",
				postcode: "",
				country: "FR",
			})
		).toBe("10 Rue de Rivoli, Paris, FR");
	});
});
