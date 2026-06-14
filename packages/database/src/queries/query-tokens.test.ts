import { describe, expect, it } from "vitest";
import { anchorToken } from "./query-tokens.ts";

describe("anchorToken", () => {
	it("returns the first whitespace-delimited token, lowercased", () => {
		expect(anchorToken("George Street")).toBe("george");
	});
	it("strips a leading unit/number so the anchor matches stored street prefixes", () => {
		expect(anchorToken("10 Bourke St")).toBe("bourke");
	});
	it("returns null for tokens shorter than 3 chars (not selective enough)", () => {
		expect(anchorToken("a b")).toBeNull();
		expect(anchorToken("")).toBeNull();
	});
	it("ignores a purely numeric first token and uses the next word", () => {
		expect(anchorToken("123 45 Main")).toBe("main");
	});
});
