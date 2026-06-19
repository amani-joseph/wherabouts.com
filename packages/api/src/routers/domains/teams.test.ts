import { ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";
import {
	acceptInvitation,
	canManageMembers,
	changeMemberRole,
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

function acceptDb(
	invite: {
		email: string;
		status: string;
		expiresAt: Date;
		teamId: string;
	} | null
) {
	const inserted: Record<string, unknown>[] = [];
	const updated: Record<string, unknown>[] = [];
	const db = {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => Promise.resolve(invite ? [invite] : []),
				}),
			}),
		}),
		insert: () => ({
			values: (v: Record<string, unknown>) => ({
				onConflictDoNothing: () => {
					inserted.push(v);
					return Promise.resolve();
				},
			}),
		}),
		update: () => ({
			set: (v: Record<string, unknown>) => ({
				where: () => {
					updated.push(v);
					return Promise.resolve();
				},
			}),
		}),
	} as unknown as Parameters<typeof acceptInvitation>[0];
	return { db, inserted, updated };
}

const ACCEPT_NOW = new Date("2026-06-20T00:00:00Z");
const FUTURE = new Date("2026-06-22T00:00:00Z");
const PAST = new Date("2026-06-19T00:00:00Z");

describe("acceptInvitation", () => {
	it("rejects when the signed-in email does not match the invite", async () => {
		const { db } = acceptDb({
			email: "joe@example.com",
			status: "pending",
			expiresAt: FUTURE,
			teamId: "t1",
		});
		await expect(
			acceptInvitation(db, {
				invitationId: "i1",
				userId: "u1",
				userEmail: "someone-else@example.com",
				now: ACCEPT_NOW,
			})
		).rejects.toBeInstanceOf(ORPCError);
	});

	it("rejects an expired invitation", async () => {
		const { db } = acceptDb({
			email: "joe@example.com",
			status: "pending",
			expiresAt: PAST,
			teamId: "t1",
		});
		await expect(
			acceptInvitation(db, {
				invitationId: "i1",
				userId: "u1",
				userEmail: "joe@example.com",
				now: ACCEPT_NOW,
			})
		).rejects.toBeInstanceOf(ORPCError);
	});

	it("adds the member and marks the invite accepted on success", async () => {
		const { db, inserted, updated } = acceptDb({
			email: "joe@example.com",
			status: "pending",
			expiresAt: FUTURE,
			teamId: "t1",
		});
		const result = await acceptInvitation(db, {
			invitationId: "i1",
			userId: "u1",
			userEmail: "Joe@Example.com",
			now: ACCEPT_NOW,
		});
		expect(result).toEqual({ teamId: "t1" });
		expect(inserted[0]).toMatchObject({ teamId: "t1", userId: "u1" });
		expect(updated[0]).toMatchObject({ status: "accepted" });
	});
});

/**
 * Build a mock db for changeMemberRole tests.
 *
 * The function makes two different selects when ownerCount <= 1 and the new
 * role is not "owner":
 *   1. countOwners  → select({count}).from(teamMembers).where(...)
 *      Returns an array with a `count` field — no `.limit()` call.
 *   2. target role  → select({role}).from(teamMembers).where(...).limit(1)
 *      Returns an array with a `role` field.
 *
 * We distinguish them by tracking call order on `select()`.
 */
function ownerCountDb(
	ownerCount: number,
	targetCurrentRole: "owner" | "member" | "admin" = "owner"
) {
	let selectCall = 0;
	return {
		select: () => {
			selectCall += 1;
			const call = selectCall;
			return {
				from: () => ({
					where: () => {
						if (call === 1) {
							// countOwners aggregate — no .limit()
							return Promise.resolve([{ count: ownerCount }]);
						}
						// target-role lookup — caller will chain .limit()
						return {
							limit: () => Promise.resolve([{ role: targetCurrentRole }]),
						};
					},
				}),
			};
		},
		update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
	} as unknown as Parameters<typeof changeMemberRole>[0];
}

describe("changeMemberRole", () => {
	it("blocks demoting the last owner", async () => {
		// Target IS the last owner; trying to set role to "member" must throw.
		await expect(
			changeMemberRole(ownerCountDb(1, "owner"), {
				teamId: "t1",
				targetUserId: "u1",
				role: "member",
			})
		).rejects.toBeInstanceOf(ORPCError);
	});

	it("allows promoting a non-owner when only one owner exists", async () => {
		// Target is a plain member; promoting to "admin" must NOT throw.
		const result = await changeMemberRole(ownerCountDb(1, "member"), {
			teamId: "t1",
			targetUserId: "u2",
			role: "admin",
		});
		expect(result).toEqual({ userId: "u2", role: "admin" });
	});
});
