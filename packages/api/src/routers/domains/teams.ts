import { ORPCError } from "@orpc/server";
import {
	projects,
	teamInvitations,
	teamMembers,
	teams,
	users,
} from "@wherabouts.com/database";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
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

function randomSeed(): string {
	return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export async function createTeamForUser(
	db: DatabaseLike,
	{ userId, name }: { userId: string; name: string }
): Promise<{ id: string; name: string; slug: string }> {
	const trimmed = name.trim().replace(/\s+/g, " ");
	const [team] = await db
		.insert(teams)
		.values({ name: trimmed, slug: generateTeamSlug(trimmed, randomSeed()) })
		.returning({ id: teams.id, name: teams.name, slug: teams.slug });
	if (!team) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Failed to create team.",
		});
	}
	await db
		.insert(teamMembers)
		.values({ teamId: team.id, userId, role: "owner" });
	return team;
}

export async function renameTeam(
	db: DatabaseLike,
	{ teamId, name }: { teamId: string; name: string }
): Promise<{ id: string; name: string }> {
	const trimmed = name.trim().replace(/\s+/g, " ");
	const [row] = await db
		.update(teams)
		.set({ name: trimmed, updatedAt: new Date() })
		.where(eq(teams.id, teamId))
		.returning({ id: teams.id, name: teams.name });
	if (!row) {
		throw new ORPCError("NOT_FOUND", { message: "Team not found." });
	}
	return row;
}

export async function deleteTeamForOwner(
	db: DatabaseLike,
	{ teamId }: { teamId: string }
): Promise<{ id: string }> {
	const existingProjects = await db
		.select({ id: projects.id })
		.from(projects)
		.where(eq(projects.teamId, teamId))
		.limit(1);
	if (existingProjects.length > 0) {
		throw new ORPCError("CONFLICT", {
			message:
				"This team still owns projects. Move or delete them before deleting the team.",
		});
	}
	await db.delete(teams).where(eq(teams.id, teamId));
	return { id: teamId };
}

async function requireManager(
	db: DatabaseLike,
	teamId: string,
	userId: string
): Promise<TeamRole> {
	const role = await resolveTeamRole(db, teamId, userId);
	if (!role) {
		throw new ORPCError("NOT_FOUND", { message: "Team not found." });
	}
	if (!canManageMembers(role)) {
		throw new ORPCError("FORBIDDEN", {
			message: "You do not have permission to manage this team.",
		});
	}
	return role;
}

export const teamsRouter = {
	listMine: protectedProcedure.handler(async ({ context }) => {
		return await listTeamsForUser(context.db, context.session.user.id);
	}),

	create: protectedProcedure
		.input(z.object({ name: z.string().trim().min(1).max(128) }))
		.handler(async ({ context, input }) => {
			return await createTeamForUser(context.db, {
				userId: context.session.user.id,
				name: input.name,
			});
		}),

	rename: protectedProcedure
		.input(
			z.object({
				teamId: z.string().uuid(),
				name: z.string().trim().min(1).max(128),
			})
		)
		.handler(async ({ context, input }) => {
			await requireManager(context.db, input.teamId, context.session.user.id);
			return await renameTeam(context.db, {
				teamId: input.teamId,
				name: input.name,
			});
		}),

	delete: protectedProcedure
		.input(z.object({ teamId: z.string().uuid() }))
		.handler(async ({ context, input }) => {
			const role = await resolveTeamRole(
				context.db,
				input.teamId,
				context.session.user.id
			);
			if (role !== "owner") {
				throw new ORPCError("FORBIDDEN", {
					message: "Only the team owner can delete a team.",
				});
			}
			return await deleteTeamForOwner(context.db, { teamId: input.teamId });
		}),
};
