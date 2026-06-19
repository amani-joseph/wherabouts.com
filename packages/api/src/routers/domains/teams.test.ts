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

import { ORPCError } from "@orpc/server";
import { deleteTeamForOwner } from "./teams.ts";

function dbWithProjectCount(count: number) {
	return {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => Promise.resolve(count > 0 ? [{ id: "p1" }] : []),
				}),
			}),
		}),
		delete: () => ({ where: () => Promise.resolve() }),
	} as unknown as Parameters<typeof deleteTeamForOwner>[0];
}

describe("deleteTeamForOwner", () => {
	it("blocks deletion when the team still owns projects", async () => {
		await expect(
			deleteTeamForOwner(dbWithProjectCount(1), { teamId: "t1" })
		).rejects.toBeInstanceOf(ORPCError);
	});

	it("deletes the team when it owns no projects", async () => {
		const result = await deleteTeamForOwner(dbWithProjectCount(0), {
			teamId: "t1",
		});
		expect(result).toEqual({ id: "t1" });
	});
});
