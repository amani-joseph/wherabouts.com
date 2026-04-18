import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnitAddress } from "./parse-unit-address.ts";

describe("parseUnitAddress", () => {
	it("parses bare slash form", () => {
		const result = parseUnitAddress("28/19 Panda Street");
		assert.deepEqual(result, {
			unitNumber: "28",
			unitNumberLast: null,
			streetNumber: "19",
			streetNumberLast: null,
			levelNumber: null,
			streetQuery: "Panda Street",
		});
	});

	it("strips unit prefix: Unit/Apt/Apartment/U/Flat", () => {
		for (const input of [
			"Unit 28/19 Panda",
			"unit 28/19 Panda",
			"UNIT 28/19 Panda",
			"Apt 28/19 Panda",
			"Apt. 28/19 Panda",
			"Apartment 28/19 Panda",
			"U28/19 Panda",
			"U 28/19 Panda",
			"Flat 28/19 Panda",
		]) {
			const result = parseUnitAddress(input);
			assert.equal(result?.unitNumber, "28", `input: ${input}`);
			assert.equal(result?.streetNumber, "19", `input: ${input}`);
			assert.equal(result?.streetQuery, "Panda", `input: ${input}`);
		}
	});

	it("strips commercial/residential prefixes: Shop/Suite/Ste/Villa/Townhouse", () => {
		for (const [input, unit] of [
			["Shop 5/19 Panda", "5"],
			["Suite 12/19 Panda", "12"],
			["Ste 12/19 Panda", "12"],
			["Villa 3/19 Panda", "3"],
			["Townhouse 2/19 Panda", "2"],
		] as const) {
			const result = parseUnitAddress(input);
			assert.equal(result?.unitNumber, unit, `input: ${input}`);
			assert.equal(result?.streetNumber, "19", `input: ${input}`);
		}
	});

	it("uppercases letter suffixes", () => {
		const result = parseUnitAddress("28a/19b Panda");
		assert.equal(result?.unitNumber, "28A");
		assert.equal(result?.streetNumber, "19B");
	});

	it("parses street-number range after slash", () => {
		const result = parseUnitAddress("28/19-21 Panda");
		assert.equal(result?.streetNumber, "19");
		assert.equal(result?.streetNumberLast, "21");
	});

	it("parses unit range before slash", () => {
		const result = parseUnitAddress("28-30/19 Panda");
		assert.equal(result?.unitNumber, "28");
		assert.equal(result?.unitNumberLast, "30");
		assert.equal(result?.streetNumber, "19");
	});

	it("parses Level prefix variants", () => {
		for (const input of [
			"L3 28/19 Panda",
			"Level 3 28/19 Panda",
			"Lvl 3 28/19 Panda",
			"Lvl. 3, 28/19 Panda",
			"L.3 28/19 Panda",
		]) {
			const result = parseUnitAddress(input);
			assert.equal(result?.levelNumber, "3", `input: ${input}`);
			assert.equal(result?.unitNumber, "28", `input: ${input}`);
			assert.equal(result?.streetNumber, "19", `input: ${input}`);
		}
	});

	it("accepts comma separator before street name", () => {
		const result = parseUnitAddress("28/19, Panda Street");
		assert.equal(result?.streetQuery, "Panda Street");
	});

	it("accepts spaces around slash", () => {
		const result = parseUnitAddress("28A / 19B Panda");
		assert.equal(result?.unitNumber, "28A");
		assert.equal(result?.streetNumber, "19B");
	});

	it("returns empty streetQuery when only numbers given", () => {
		const result = parseUnitAddress("1/1");
		assert.equal(result?.unitNumber, "1");
		assert.equal(result?.streetNumber, "1");
		assert.equal(result?.streetQuery, "");
	});

	it("returns null for non-slash inputs", () => {
		for (const input of [
			"Panda Street",
			"28 Panda",
			"Utah 28 Panda",
			"/",
			"28//19",
			"",
			"   ",
		]) {
			assert.equal(parseUnitAddress(input), null, `input: ${input}`);
		}
	});

	it("does not mis-trigger on words starting with U/L that are not prefixes", () => {
		assert.equal(parseUnitAddress("Utah 28/19 Panda"), null);
		assert.equal(parseUnitAddress("Lane Cove 28/19 Panda"), null);
	});

	it("combines Level prefix with unit prefix", () => {
		const result = parseUnitAddress("Level 3 Unit 28/19 Panda");
		assert.equal(result?.levelNumber, "3");
		assert.equal(result?.unitNumber, "28");
		assert.equal(result?.streetNumber, "19");
	});
});
