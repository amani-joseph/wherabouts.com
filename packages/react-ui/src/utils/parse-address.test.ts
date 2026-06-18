import type { AddressSuggestion } from "@wherabouts/sdk";
import { describe, expect, it } from "vitest";
import { cleanAddressInput, toAddressWithParsed } from "./parse-address";

describe("cleanAddressInput", () => {
	it("collapses whitespace and trims", () => {
		expect(cleanAddressInput("  1   Rocket   Road  ")).toBe("1 Rocket Road");
	});

	it("normalizes spacing around commas", () => {
		expect(cleanAddressInput("1 Rocket Road ,Hawthorne,  CA 90250")).toBe(
			"1 Rocket Road, Hawthorne, CA 90250"
		);
	});

	it("returns empty string unchanged", () => {
		expect(cleanAddressInput("")).toBe("");
	});
});

describe("toAddressWithParsed", () => {
	it("maps standard AU address correctly", () => {
		const suggestion: AddressSuggestion = {
			id: 1,
			formattedAddress: "29/14 Fleet Street, Browns Plains QLD 4118",
			streetAddress: "29/14 Fleet Street",
			locality: "Browns Plains",
			state: "QLD",
			postcode: "4118",
			latitude: -27.7849,
			longitude: 153.0395,
			country: "AU",
		};

		const result = toAddressWithParsed(suggestion);

		expect(result).toEqual({
			id: 1,
			formattedAddress: "29/14 Fleet Street, Browns Plains QLD 4118",
			latitude: -27.7849,
			longitude: 153.0395,
			streetAddress: "29/14 Fleet Street",
			suburb: "Browns Plains",
			state: "QLD",
			postcode: "4118",
			country: "Australia",
		});
	});

	it("falls back to raw country code if unknown", () => {
		const suggestion: AddressSuggestion = {
			id: 2,
			formattedAddress: "123 Main St, Sydney NSW 2000",
			streetAddress: "123 Main St",
			locality: "Sydney",
			state: "NSW",
			postcode: "2000",
			latitude: -33.8688,
			longitude: 151.2093,
			country: "NZ",
		};

		const result = toAddressWithParsed(suggestion);

		expect(result.country).toBe("NZ");
	});

	it("preserves all original fields in transformation", () => {
		const suggestion: AddressSuggestion = {
			id: 123,
			formattedAddress: "Test Address",
			streetAddress: "Test Street",
			locality: "Test Suburb",
			state: "TS",
			postcode: "1234",
			latitude: 0,
			longitude: 0,
			country: "AU",
		};

		const result = toAddressWithParsed(suggestion);

		expect(result.id).toBe(123);
		expect(result.streetAddress).toBe("Test Street");
		expect(result.latitude).toBe(0);
		expect(result.longitude).toBe(0);
	});
});
