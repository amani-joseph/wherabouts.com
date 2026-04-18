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
import { teams } from "./teams.ts";

export const apiKeys = pgTable(
	"api_keys",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id").notNull(),
		name: text("name").notNull(),
		secretHash: text("secret_hash").notNull(),
		secretSalt: text("secret_salt").notNull(),
		/** Last 4 characters of the secret segment for display (e.g. wh_<uuid>_...abcd) */
		secretDisplaySuffix: text("secret_display_suffix").notNull(),
		projectId: uuid("project_id").references(() => projects.id, {
			onDelete: "cascade",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		teamId: uuid("team_id").references(() => teams.id, {
			onDelete: "cascade",
		}),
		secretCiphertext: text("secret_ciphertext"),
		secretIv: text("secret_iv"),
	},
	(table) => [
		index("idx_api_keys_user_id").on(table.userId),
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
		userId: text("user_id").notNull(),
		projectId: uuid("project_id").references(() => projects.id, {
			onDelete: "cascade",
		}),
		usageDate: date("usage_date", { mode: "string" }).notNull(),
		endpoint: text("endpoint").notNull(),
		requestSource: text("request_source").notNull().default("production"),
		requestCount: integer("request_count").notNull().default(0),
	},
	(table) => [
		uniqueIndex("api_usage_daily_key_date_endpoint").on(
			table.apiKeyId,
			table.usageDate,
			table.endpoint,
			table.requestSource
		),
		index("idx_api_usage_daily_user_id").on(table.userId),
		index("idx_api_usage_daily_api_key_id").on(table.apiKeyId),
		index("idx_api_usage_daily_project_id").on(table.projectId),
		index("idx_api_usage_daily_user_date").on(table.userId, table.usageDate),
		index("idx_api_usage_daily_user_date_source").on(
			table.userId,
			table.usageDate,
			table.requestSource
		),
		index("idx_api_usage_daily_user_date_endpoint").on(
			table.userId,
			table.usageDate,
			table.endpoint
		),
	]
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiUsageDaily = typeof apiUsageDaily.$inferSelect;
export type NewApiUsageDaily = typeof apiUsageDaily.$inferInsert;
