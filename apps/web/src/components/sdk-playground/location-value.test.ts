import { describe, expect, it } from "vitest";
import { coordValueFromCandidate, isValidLatLng } from "./location-value.ts";

describe("isValidLatLng", () => {
	it("accepts a well-formed coordinate", () => {
		expect(isValidLatLng("-27.47,153.02")).toBe(true);
	});
	it("rejects out-of-range latitude", () => {
		expect(isValidLatLng("120,10")).toBe(false);
	});
	it("rejects non-numeric and wrong-arity input", () => {
		expect(isValidLatLng("Brisbane")).toBe(false);
		expect(isValidLatLng("1,2,3")).toBe(false);
	});
});

describe("coordValueFromCandidate", () => {
	it("formats latitude,longitude", () => {
		expect(
			coordValueFromCandidate({ latitude: -27.47, longitude: 153.02 })
		).toBe("-27.47,153.02");
	});
});
