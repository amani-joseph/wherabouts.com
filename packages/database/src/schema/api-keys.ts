import {
	date,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { projects } from "./projects.ts";

export const apiKeys = pgTable(
	"api_keys",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		clerkUserId: text("clerk_user_id").notNull(),
		name: text("name").notNull(),
		secretHash: text("secret_hash").notNull(),
		secretSalt: text("secret_salt").notNull(),
		/** Last 4 characters of the secret segment for display (e.g. wh_<uuid>_...abcd) */
		secretDisplaySuffix: text("secret_display_suffix").notNull(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, {
				onDelete: "cascade",
			}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
	},
	(table) => [
		index("idx_api_keys_clerk_user_id").on(table.clerkUserId),
		index("idx_api_keys_project_id").on(table.projectId),
	]
);

export const apiUsageDaily = pgTable(
	"api_usage_daily",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		apiKeyId: uuid("api_key_id")
			.notNull()
			.references(() => apiKeys.id, { onDelete: "cascade" }),
		clerkUserId: text("clerk_user_id").notNull(),
		projectId: uuid("project_id").references(() => projects.id, {
			onDelete: "cascade",
		}),
		usageDate: date("usage_date", { mode: "string" }).notNull(),
		endpoint: text("endpoint").notNull(),
		requestCount: integer("request_count").notNull().default(0),
	},
	(table) => [
		uniqueIndex("api_usage_daily_key_date_endpoint").on(
			table.apiKeyId,
			table.usageDate,
			table.endpoint
		),
		index("idx_api_usage_daily_clerk_user_id").on(table.clerkUserId),
		index("idx_api_usage_daily_api_key_id").on(table.apiKeyId),
		index("idx_api_usage_daily_project_id").on(table.projectId),
	]
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiUsageDaily = typeof apiUsageDaily.$inferSelect;
export type NewApiUsageDaily = typeof apiUsageDaily.$inferInsert;
