import "dotenv/config";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { createDb } from "./client.ts";
import { apiKeys, apiUsageDaily } from "./schema/api-keys.ts";

async function backfillUsageProjectIds() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL environment variable is required");
	}

	const db = createDb(databaseUrl);

	// Unassigned keys are now valid. This script only repairs legacy usage rows
	// that predate project-aware usage accounting for keys that are currently assigned.
	const rows = await db
		.select({
			usageId: apiUsageDaily.id,
			projectId: apiKeys.projectId,
		})
		.from(apiUsageDaily)
		.innerJoin(apiKeys, eq(apiUsageDaily.apiKeyId, apiKeys.id))
		.where(and(isNull(apiUsageDaily.projectId), isNotNull(apiKeys.projectId)));

	console.log(`Found ${rows.length} usage row(s) missing project_id`);

	for (const row of rows) {
		if (!row.projectId) {
			continue;
		}

		await db
			.update(apiUsageDaily)
			.set({ projectId: row.projectId })
			.where(eq(apiUsageDaily.id, row.usageId));
	}

	console.log("Backfill complete. Unassigned API keys remain valid.");
}

backfillUsageProjectIds().catch((err) => {
	console.error("Backfill failed:", err);
	process.exit(1);
});
