import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { webhookSubscriptions } from "./webhooks.ts";

export const webhookDeliveryAttempts = pgTable(
	"webhook_delivery_attempts",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		subscriptionId: integer("subscription_id")
			.notNull()
			.references(() => webhookSubscriptions.id, { onDelete: "cascade" }),
		event: varchar({ length: 10 }).notNull(),
		zoneId: integer("zone_id"),
		deviceId: varchar("device_id", { length: 255 }),
		statusCode: integer("status_code"),
		ok: boolean().notNull(),
		attempt: integer().notNull(),
		error: text(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_webhook_attempts_subscription_id").on(table.subscriptionId),
		index("idx_webhook_attempts_created_at").on(table.createdAt),
	]
);

export type WebhookDeliveryAttempt = typeof webhookDeliveryAttempts.$inferSelect;
export type NewWebhookDeliveryAttempt = typeof webhookDeliveryAttempts.$inferInsert;
