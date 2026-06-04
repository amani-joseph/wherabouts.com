import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { projects } from "./projects.ts";
import { apiKeys } from "./api-keys.ts";

export const batchGeocodeJobs = pgTable(
	"batch_geocode_jobs",
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		apiKeyId: uuid("api_key_id")
			.notNull()
			.references(() => apiKeys.id, { onDelete: "cascade" }),
		status: text().notNull().default("pending"),
		inputCount: integer("input_count").notNull(),
		processedCount: integer("processed_count").notNull().default(0),
		resultsR2Key: text("results_r2_key"),
		error: text(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("idx_batch_jobs_project_id").on(table.projectId),
		index("idx_batch_jobs_status").on(table.status),
	]
);

export type BatchGeocodeJob = typeof batchGeocodeJobs.$inferSelect;
export type NewBatchGeocodeJob = typeof batchGeocodeJobs.$inferInsert;
