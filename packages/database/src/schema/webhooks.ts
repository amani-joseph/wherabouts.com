import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { projects } from "./projects.ts";
import { zones } from "./zones.ts";

export const webhookSubscriptions = pgTable(
	"webhook_subscriptions",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		zoneId: integer("zone_id").references(() => zones.id, {
			onDelete: "cascade",
		}),
		url: text().notNull(),
		events: text("events")
			.array()
			.notNull()
			.default(sql`ARRAY['entry','exit']::text[]`),
		secretEnc: text("secret_enc").notNull(),
		active: boolean().notNull().default(true),
		failing: boolean().notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_webhook_subs_project_id").on(table.projectId),
		index("idx_webhook_subs_zone_id").on(table.zoneId),
	]
);

export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;
