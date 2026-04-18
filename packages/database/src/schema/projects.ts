import {
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { teams } from "./teams.ts";

export const projects = pgTable(
	"projects",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id").notNull(),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		teamId: uuid("team_id").references(() => teams.id, {
			onDelete: "cascade",
		}),
	},
	(table) => [
		uniqueIndex("uq_projects_user_slug").on(table.userId, table.slug),
		uniqueIndex("uq_projects_team_slug").on(table.teamId, table.slug),
		index("idx_projects_user_id").on(table.userId),
	]
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
