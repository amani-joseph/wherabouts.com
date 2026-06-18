import { describe, expect, it } from "vitest";
import {
	canonicalStreetType,
	directionalVariants,
	isDirectional,
} from "./address-abbreviations.ts";

describe("directionalVariants", () => {
	it("returns both abbreviated and expanded forms (uppercase)", () => {
		expect(directionalVariants("N")).toEqual(["N", "NORTH"]);
		expect(directionalVariants("north")).toEqual(["N", "NORTH"]);
		expect(directionalVariants("SW")).toEqual(["SW", "SOUTHWEST"]);
	});

	it("returns the single token when not a directional", () => {
		expect(directionalVariants("ROCKET")).toEqual(["ROCKET"]);
	});
});

describe("isDirectional", () => {
	it("recognizes directional tokens case-insensitively", () => {
		expect(isDirectional("n")).toBe(true);
		expect(isDirectional("NORTH")).toBe(true);
		expect(isDirectional("Rocket")).toBe(false);
	});
});

describe("canonicalStreetType", () => {
	it("canonicalizes abbreviations and full forms to the full word", () => {
		expect(canonicalStreetType("Rd")).toBe("ROAD");
		expect(canonicalStreetType("road")).toBe("ROAD");
		expect(canonicalStreetType("ST")).toBe("STREET");
	});

	it("returns the uppercased token unchanged when unknown", () => {
		expect(canonicalStreetType("Rocket")).toBe("ROCKET");
	});
});
