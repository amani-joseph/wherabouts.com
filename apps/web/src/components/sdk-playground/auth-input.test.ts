import { describe, expect, it } from "vitest";
import { detectAuthInput, type SavedApiKey } from "./auth-input.ts";

const KEYS: SavedApiKey[] = [
	{
		id: "11111111-1111-1111-1111-111111111111",
		name: "Prod",
		displayLabel: "wh_1111…aaaa",
	},
	{
		id: "22222222-2222-2222-2222-222222222222",
		name: "Staging",
		displayLabel: "wh_2222…bbbb",
	},
];

describe("detectAuthInput", () => {
	it("classifies a wh_<id>_<secret> string as a raw key", () => {
		const out = detectAuthInput("wh_abc_secretpart", KEYS);
		expect(out).toEqual({ kind: "raw", rawApiKey: "wh_abc_secretpart" });
	});

	it("filters saved keys by name, case-insensitive", () => {
		const out = detectAuthInput("stag", KEYS);
		expect(out).toEqual({ kind: "filter", matches: [KEYS[1]] });
	});

	it("filters saved keys by display label", () => {
		const out = detectAuthInput("2222", KEYS);
		expect(out).toEqual({ kind: "filter", matches: [KEYS[1]] });
	});

	it("returns all keys for empty input", () => {
		const out = detectAuthInput("", KEYS);
		expect(out).toEqual({ kind: "filter", matches: KEYS });
	});

	it("returns an empty match list when nothing matches", () => {
		const out = detectAuthInput("zzz", KEYS);
		expect(out).toEqual({ kind: "filter", matches: [] });
	});

	it("treats whitespace-only input as empty (returns all keys)", () => {
		const out = detectAuthInput("   ", KEYS);
		expect(out).toEqual({ kind: "filter", matches: KEYS });
	});
});
