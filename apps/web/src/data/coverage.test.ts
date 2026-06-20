import { describe, expect, it } from "vitest";
import {
	COVERAGE_COUNTRIES,
	type CoverageCountry,
	filterCountries,
	iso2ToFlag,
} from "./coverage";

describe("iso2ToFlag", () => {
	it("converts an ISO-2 code to its flag emoji", () => {
		expect(iso2ToFlag("US")).toBe("🇺🇸");
		expect(iso2ToFlag("AU")).toBe("🇦🇺");
	});

	it("is case-insensitive", () => {
		expect(iso2ToFlag("gb")).toBe(iso2ToFlag("GB"));
	});
});

describe("filterCountries", () => {
	const sample: CoverageCountry[] = [
		{ iso2: "US", name: "United States", capabilities: ["geocode"] },
		{ iso2: "AU", name: "Australia", capabilities: ["geocode"] },
		{ iso2: "DE", name: "Germany", capabilities: ["geocode"] },
	];

	it("returns the full list for an empty or whitespace query", () => {
		expect(filterCountries("", sample)).toHaveLength(3);
		expect(filterCountries("   ", sample)).toHaveLength(3);
	});

	it("matches by name, case-insensitively", () => {
		expect(filterCountries("german", sample)).toEqual([sample[2]]);
	});

	it("matches by ISO-2 code", () => {
		expect(filterCountries("au", sample)).toEqual([sample[1]]);
	});

	it("returns an empty array when nothing matches", () => {
		expect(filterCountries("zzz", sample)).toEqual([]);
	});
});

describe("COVERAGE_COUNTRIES", () => {
	it("contains exactly the 17 supported countries", () => {
		expect(COVERAGE_COUNTRIES).toHaveLength(17);
	});

	it("is sorted alphabetically by name", () => {
		const names = COVERAGE_COUNTRIES.map((c) => c.name);
		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
	});

	it("gives every country at least one capability", () => {
		for (const country of COVERAGE_COUNTRIES) {
			expect(country.capabilities.length).toBeGreaterThan(0);
		}
	});
});
