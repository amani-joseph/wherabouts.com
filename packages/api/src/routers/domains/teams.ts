import {
	teamInvitations,
	teamMembers,
	teams,
	users,
} from "@wherabouts.com/database";
import { and, eq, inArray } from "drizzle-orm";
import type { Context } from "../../context.ts";
import { protectedProcedure } from "../../procedures.ts";

type DatabaseLike = Context["db"];

export type TeamRole = "owner" | "admin" | "member";

const SLUG_SANITIZE_REGEX = /[^a-z0-9]+/g;
const SLUG_TRIM_REGEX = /^-+|-+$/g;

export function generateTeamSlug(name: string, seed: string): string {
	const base = name
		.toLowerCase()
		.replace(SLUG_SANITIZE_REGEX, "-")
		.replace(SLUG_TRIM_REGEX, "");
	return `${base || "team"}-${seed}`;
}

export function canManageMembers(role: TeamRole | null): boolean {
	return role === "owner" || role === "admin";
}

export async function resolveTeamRole(
	db: DatabaseLike,
	teamId: string,
	userId: string
): Promise<TeamRole | null> {
	const [row] = await db
		.select({ role: teamMembers.role })
		.from(teamMembers)
		.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
		.limit(1);
	return (row?.role as TeamRole | undefined) ?? null;
}

export interface TeamMemberView {
	email: string;
	joinedAt: Date;
	name: string | null;
	role: TeamRole;
	userId: string;
}

export interface TeamInviteView {
	createdAt: Date;
	email: string;
	expiresAt: Date;
	id: string;
	role: TeamRole;
}

export interface TeamWithMembers {
	members: TeamMemberView[];
	myRole: TeamRole;
	pendingInvites: TeamInviteView[];
	team: { id: string; name: string; slug: string };
}

export async function listTeamsForUser(
	db: DatabaseLike,
	userId: string
): Promise<TeamWithMembers[]> {
	const memberships = await db
		.select({
			teamId: teams.id,
			name: teams.name,
			slug: teams.slug,
			myRole: teamMembers.role,
		})
		.from(teamMembers)
		.innerJoin(teams, eq(teams.id, teamMembers.teamId))
		.where(eq(teamMembers.userId, userId));

	const teamIds = memberships.map((m) => m.teamId);
	if (teamIds.length === 0) {
		return [];
	}

	const memberRows = await db
		.select({
			teamId: teamMembers.teamId,
			userId: teamMembers.userId,
			role: teamMembers.role,
			joinedAt: teamMembers.createdAt,
			name: users.name,
			email: users.email,
		})
		.from(teamMembers)
		.innerJoin(users, eq(users.id, teamMembers.userId))
		.where(inArray(teamMembers.teamId, teamIds));

	const inviteRows = await db
		.select({
			id: teamInvitations.id,
			teamId: teamInvitations.teamId,
			email: teamInvitations.email,
			role: teamInvitations.role,
			expiresAt: teamInvitations.expiresAt,
			createdAt: teamInvitations.createdAt,
		})
		.from(teamInvitations)
		.where(
			and(
				inArray(teamInvitations.teamId, teamIds),
				eq(teamInvitations.status, "pending")
			)
		);

	return memberships.map((m) => ({
		team: { id: m.teamId, name: m.name, slug: m.slug },
		myRole: m.myRole as TeamRole,
		members: memberRows
			.filter((r) => r.teamId === m.teamId)
			.map((r) => ({
				userId: r.userId,
				name: r.name,
				email: r.email,
				role: r.role as TeamRole,
				joinedAt: r.joinedAt,
			})),
		pendingInvites: inviteRows
			.filter((r) => r.teamId === m.teamId)
			.map((r) => ({
				id: r.id,
				email: r.email,
				role: r.role as TeamRole,
				expiresAt: r.expiresAt,
				createdAt: r.createdAt,
			})),
	}));
}

export const teamsRouter = {
	listMine: protectedProcedure.handler(async ({ context }) => {
		return await listTeamsForUser(context.db, context.session.user.id);
	}),
};
