import { ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";
import {
	canManageMembers,
	createInvitation,
	deleteTeamForOwner,
	generateTeamSlug,
} from "./teams.ts";

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

const INVITE_NOW = new Date("2026-06-20T00:00:00Z");

function inviteDb(opts: { memberExists: boolean; pendingExists: boolean }) {
	let selectCall = 0;
	const inserted: Record<string, unknown>[] = [];
	const db = {
		select: () => ({
			from: () => ({
				innerJoin: () => ({
					where: () => ({
						limit: () =>
							Promise.resolve(opts.memberExists ? [{ id: "m1" }] : []),
					}),
				}),
				where: () => ({
					limit: () => {
						selectCall += 1;
						return Promise.resolve(opts.pendingExists ? [{ id: "i1" }] : []);
					},
				}),
			}),
		}),
		insert: () => ({
			values: (v: Record<string, unknown>) => ({
				returning: () => {
					inserted.push(v);
					return Promise.resolve([
						{
							id: "new-invite",
							email: v.email,
							role: v.role,
							expiresAt: v.expiresAt,
						},
					]);
				},
			}),
		}),
	} as unknown as Parameters<typeof createInvitation>[0];
	return { db, inserted, selectCall: () => selectCall };
}

describe("createInvitation", () => {
	it("rejects when the email is already a member", async () => {
		const { db } = inviteDb({ memberExists: true, pendingExists: false });
		await expect(
			createInvitation(db, {
				teamId: "t1",
				email: "joe@example.com",
				role: "member",
				invitedBy: "owner1",
				now: INVITE_NOW,
			})
		).rejects.toBeInstanceOf(ORPCError);
	});

	it("rejects when a pending invite already exists", async () => {
		const { db } = inviteDb({ memberExists: false, pendingExists: true });
		await expect(
			createInvitation(db, {
				teamId: "t1",
				email: "joe@example.com",
				role: "member",
				invitedBy: "owner1",
				now: INVITE_NOW,
			})
		).rejects.toBeInstanceOf(ORPCError);
	});

	it("inserts a pending invite expiring 72h from now", async () => {
		const { db, inserted } = inviteDb({
			memberExists: false,
			pendingExists: false,
		});
		const result = await createInvitation(db, {
			teamId: "t1",
			email: "Joe@Example.com",
			role: "member",
			invitedBy: "owner1",
			now: INVITE_NOW,
		});
		expect(result.id).toBe("new-invite");
		// biome-ignore lint/style/noNonNullAssertion: inserted is always populated by the mock above
		const row = inserted[0]!;
		expect(row.email).toBe("joe@example.com");
		expect(row.status).toBe("pending");
		const expiresAt = row.expiresAt as Date;
		expect(expiresAt.getTime() - INVITE_NOW.getTime()).toBe(
			72 * 60 * 60 * 1000
		);
	});
});
