import "dotenv/config";
import { isNull, sql } from "drizzle-orm";
import { createDb } from "./client.ts";
import { apiKeys, apiUsageDaily } from "./schema/api-keys.ts";
import { projects } from "./schema/projects.ts";

async function backfillDefaultProjects() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL environment variable is required");
	}

	const db = createDb(databaseUrl);

	// Step 1: Find all distinct users who have API keys without a project
	const orphanedUsers = await db
		.selectDistinct({ clerkUserId: apiKeys.clerkUserId })
		.from(apiKeys)
		.where(isNull(apiKeys.projectId));

	console.log(`Found ${orphanedUsers.length} user(s) with unscoped API keys`);

	for (const { clerkUserId } of orphanedUsers) {
		// Step 2: Create a default project for this user
		const [defaultProject] = await db
			.insert(projects)
			.values({
				clerkUserId,
				name: "My First Project",
				slug: "my-first-project",
			})
			.onConflictDoNothing()
			.returning({ id: projects.id });

		if (!defaultProject) {
			// Project already exists (slug conflict), find it
			const [existing] = await db
				.select({ id: projects.id })
				.from(projects)
				.where(
					sql`${projects.clerkUserId} = ${clerkUserId} AND ${projects.slug} = 'my-first-project'`
				);
			if (!existing) {
				console.error(
					`Failed to create or find default project for user ${clerkUserId}`
				);
				continue;
			}
			console.log(
				`Using existing default project ${existing.id} for user ${clerkUserId}`
			);

			// Assign orphaned keys
			await db
				.update(apiKeys)
				.set({ projectId: existing.id })
				.where(
					sql`${apiKeys.clerkUserId} = ${clerkUserId} AND ${apiKeys.projectId} IS NULL`
				);

			// Assign orphaned usage records
			await db
				.update(apiUsageDaily)
				.set({ projectId: existing.id })
				.where(
					sql`${apiUsageDaily.clerkUserId} = ${clerkUserId} AND ${apiUsageDaily.projectId} IS NULL`
				);

			continue;
		}

		console.log(
			`Created default project ${defaultProject.id} for user ${clerkUserId}`
		);

		// Step 3: Assign all orphaned keys for this user to the default project
		const keysUpdated = await db
			.update(apiKeys)
			.set({ projectId: defaultProject.id })
			.where(
				sql`${apiKeys.clerkUserId} = ${clerkUserId} AND ${apiKeys.projectId} IS NULL`
			)
			.returning({ id: apiKeys.id });

		console.log(`  Assigned ${keysUpdated.length} key(s) to default project`);

		// Step 4: Assign orphaned usage records for this user
		await db
			.update(apiUsageDaily)
			.set({ projectId: defaultProject.id })
			.where(
				sql`${apiUsageDaily.clerkUserId} = ${clerkUserId} AND ${apiUsageDaily.projectId} IS NULL`
			);
	}

	// Step 5: Verify no orphaned keys remain
	const remaining = await db
		.select({ count: sql<number>`count(*)` })
		.from(apiKeys)
		.where(isNull(apiKeys.projectId));

	const orphanCount = Number(remaining[0]?.count ?? 0);
	if (orphanCount > 0) {
		throw new Error(
			`Backfill incomplete: ${orphanCount} key(s) still have no project_id`
		);
	}

	console.log("Backfill complete. All API keys are now project-scoped.");
}

backfillDefaultProjects().catch((err) => {
	console.error("Backfill failed:", err);
	process.exit(1);
});
