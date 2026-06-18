import { describe, expect, it } from "vitest";
import { matchCountry } from "./country-codes.ts";

describe("matchCountry", () => {
	it("maps full names to ISO-2", () => {
		expect(matchCountry("United States")).toBe("US");
		expect(matchCountry("france")).toBe("FR");
		expect(matchCountry("Australia")).toBe("AU");
		expect(matchCountry("United Kingdom")).toBe("GB");
	});

	it("maps common aliases and bare codes", () => {
		expect(matchCountry("USA")).toBe("US");
		expect(matchCountry("UK")).toBe("GB");
		expect(matchCountry("US")).toBe("US");
		expect(matchCountry("  fr  ")).toBe("FR");
	});

	it("returns null for non-country text", () => {
		expect(matchCountry("Hawthorne")).toBeNull();
		expect(matchCountry("")).toBeNull();
	});
});
