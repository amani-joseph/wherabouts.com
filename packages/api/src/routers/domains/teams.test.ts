import { describe, expect, it } from "vitest";
import { canManageMembers, generateTeamSlug } from "./teams.ts";

describe("generateTeamSlug", () => {
	it("lowercases, replaces non-alphanumerics with dashes, and appends the seed", () => {
		expect(generateTeamSlug("Acme Corp!", "abcd1234")).toBe(
			"acme-corp-abcd1234"
		);
	});

	it("falls back to 'team' when the name has no usable characters", () => {
		expect(generateTeamSlug("!!!", "seed0001")).toBe("team-seed0001");
	});
});

describe("canManageMembers", () => {
	it("allows owner and admin, denies member and null", () => {
		expect(canManageMembers("owner")).toBe(true);
		expect(canManageMembers("admin")).toBe(true);
		expect(canManageMembers("member")).toBe(false);
		expect(canManageMembers(null)).toBe(false);
	});
});
