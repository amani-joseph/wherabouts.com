import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth.ts";

export const securityAuditLog = pgTable(
	"security_audit_log",
	{
		id: text("id").primaryKey(),
		// Null after the user is deleted so audit history survives deletion.
		userId: text("user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		action: text("action").notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("security_audit_log_user_created_idx").on(
			table.userId,
			table.createdAt
		),
	]
);

export type SecurityAuditLog = typeof securityAuditLog.$inferSelect;
export type NewSecurityAuditLog = typeof securityAuditLog.$inferInsert;
