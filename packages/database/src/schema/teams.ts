import {
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.ts";

export const teams = pgTable(
	"teams",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [uniqueIndex("uq_teams_slug").on(t.slug)]
);

export const teamMembers = pgTable(
	"team_members",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		teamId: uuid("team_id")
			.notNull()
			.references(() => teams.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: text("role").notNull(), // "owner" | "admin" | "member"
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		uniqueIndex("uq_team_members_team_user").on(t.teamId, t.userId),
	]
);

export const teamInvitations = pgTable("team_invitations", {
	id: uuid("id").primaryKey().defaultRandom(),
	teamId: uuid("team_id")
		.notNull()
		.references(() => teams.id, { onDelete: "cascade" }),
	email: text("email").notNull(),
	role: text("role").notNull(),
	invitedBy: text("invited_by")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	status: text("status").notNull().default("pending"), // "pending" | "accepted" | "revoked" | "expired"
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type NewTeamInvitation = typeof teamInvitations.$inferInsert;
