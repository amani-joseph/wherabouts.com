import { apiKeys, projects } from "@wherabouts.com/database";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import type { Context } from "../../context.ts";
import { protectedProcedure } from "../../procedures.ts";
import {
	createApiKeyRecord,
	listActiveApiKeyRowsForUser,
	serializeApiKey,
} from "./api-keys-shared.ts";

type DatabaseLike = Context["db"];

const createProjectInputSchema = z.object({
	name: z.string().min(1).max(128),
	selectedApiKeyId: z.string().uuid().optional(),
});

const updateProjectApiKeyInputSchema = z.object({
	projectId: z.string().uuid(),
	apiKeyId: z.string().uuid(),
});

function normalizeProjectName(name: string): string {
	return name.trim().replace(/\s+/g, " ");
}

function slugifyProjectName(name: string): string {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return slug.length > 0 ? slug : "project";
}

async function resolveUniqueProjectSlug(
	db: DatabaseLike,
	userId: string,
	name: string
): Promise<string> {
	const baseSlug = slugifyProjectName(name).slice(0, 48);
	let nextIndex = 1;

	while (true) {
		const suffix = nextIndex === 1 ? "" : `-${nextIndex}`;
		const slug = `${baseSlug.slice(0, 48 - suffix.length)}${suffix}`;
		const [existingProject] = await db
			.select({ id: projects.id })
			.from(projects)
			.where(and(eq(projects.userId, userId), eq(projects.slug, slug)))
			.limit(1);

		if (!existingProject) {
			return slug;
		}

		nextIndex += 1;
	}
}

async function assignApiKeyToProject(
	db: DatabaseLike,
	input: {
		apiKeyId: string;
		projectId: string;
		userId: string;
	}
) {
	const [targetKey] = await db
		.select({
			id: apiKeys.id,
			name: apiKeys.name,
			secretDisplaySuffix: apiKeys.secretDisplaySuffix,
			projectId: apiKeys.projectId,
			createdAt: apiKeys.createdAt,
			lastUsedAt: apiKeys.lastUsedAt,
		})
		.from(apiKeys)
		.where(
			and(
				eq(apiKeys.id, input.apiKeyId),
				eq(apiKeys.userId, input.userId),
				isNull(apiKeys.revokedAt)
			)
		)
		.limit(1);

	if (!targetKey) {
		throw new Error("Selected API key was not found.");
	}

	if (targetKey.projectId && targetKey.projectId !== input.projectId) {
		throw new Error("Selected API key is already assigned to another project.");
	}

	await db
		.update(apiKeys)
		.set({ projectId: null })
		.where(
			and(
				eq(apiKeys.userId, input.userId),
				eq(apiKeys.projectId, input.projectId),
				ne(apiKeys.id, targetKey.id),
				isNull(apiKeys.revokedAt)
			)
		);

	const assignedKey =
		targetKey.projectId === input.projectId
			? targetKey
			: (
					await db
						.update(apiKeys)
						.set({ projectId: input.projectId })
						.where(
							and(
								eq(apiKeys.id, targetKey.id),
								eq(apiKeys.userId, input.userId),
								isNull(apiKeys.revokedAt)
							)
						)
						.returning({
							id: apiKeys.id,
							name: apiKeys.name,
							secretDisplaySuffix: apiKeys.secretDisplaySuffix,
							projectId: apiKeys.projectId,
							createdAt: apiKeys.createdAt,
							lastUsedAt: apiKeys.lastUsedAt,
						})
				)[0];

	if (!assignedKey) {
		throw new Error("Failed to assign the selected API key.");
	}

	return serializeApiKey(assignedKey, null);
}

export const projectsRouter = {
	list: protectedProcedure.handler(async ({ context }) => {
		const authUserId = context.session.user.id;
		const projectRows = await context.db
			.select({
				id: projects.id,
				name: projects.name,
				slug: projects.slug,
				createdAt: projects.createdAt,
			})
			.from(projects)
			.where(and(eq(projects.userId, authUserId), isNull(projects.archivedAt)))
			.orderBy(asc(projects.createdAt));
		const keyRows = await listActiveApiKeyRowsForUser(context.db, authUserId);
		const keyByProjectId = new Map(
			keyRows
				.filter((row) => row.projectId)
				.map((row) => [row.projectId as string, serializeApiKey(row, null)])
		);

		return projectRows.map((project) => ({
			id: project.id,
			name: project.name,
			slug: project.slug,
			createdAt: project.createdAt.toISOString(),
			apiKey: keyByProjectId.get(project.id) ?? null,
		}));
	}),
	listApiKeyOptions: protectedProcedure.handler(async ({ context }) => {
		const authUserId = context.session.user.id;
		const projectRows = await context.db
			.select({
				id: projects.id,
				name: projects.name,
			})
			.from(projects)
			.where(eq(projects.userId, authUserId));
		const projectNameById = new Map(
			projectRows.map((project) => [project.id, project.name])
		);
		const keyRows = await listActiveApiKeyRowsForUser(context.db, authUserId);

		return keyRows.map((row) =>
			serializeApiKey(
				row,
				row.projectId ? (projectNameById.get(row.projectId) ?? null) : null
			)
		);
	}),
	create: protectedProcedure
		.input(createProjectInputSchema)
		.handler(async ({ context, input }) => {
			const authUserId = context.session.user.id;
			const name = normalizeProjectName(input.name);
			const slug = await resolveUniqueProjectSlug(context.db, authUserId, name);
			const [createdProject] = await context.db
				.insert(projects)
				.values({
					userId: authUserId,
					name,
					slug,
				})
				.returning({
					id: projects.id,
					name: projects.name,
					slug: projects.slug,
					createdAt: projects.createdAt,
				});

			if (!createdProject) {
				throw new Error("Failed to create project.");
			}

			if (input.selectedApiKeyId) {
				const assignedKey = await assignApiKeyToProject(context.db, {
					userId: authUserId,
					projectId: createdProject.id,
					apiKeyId: input.selectedApiKeyId,
				});

				return {
					id: createdProject.id,
					name: createdProject.name,
					slug: createdProject.slug,
					createdAt: createdProject.createdAt.toISOString(),
					apiKey: {
						...assignedKey,
						assignedProjectName: createdProject.name,
						assignmentStatus: "assigned" as const,
					},
					generatedKey: null,
				};
			}

			const generatedKey = await createApiKeyRecord(context.db, {
				userId: authUserId,
				name,
				projectId: createdProject.id,
			});

			return {
				id: createdProject.id,
				name: createdProject.name,
				slug: createdProject.slug,
				createdAt: createdProject.createdAt.toISOString(),
				apiKey: {
					...generatedKey,
					assignedProjectName: createdProject.name,
					assignmentStatus: "assigned" as const,
				},
				generatedKey,
			};
		}),
	assignApiKey: protectedProcedure
		.input(updateProjectApiKeyInputSchema)
		.handler(async ({ context, input }) => {
			const authUserId = context.session.user.id;
			const [projectRow] = await context.db
				.select({
					id: projects.id,
					name: projects.name,
				})
				.from(projects)
				.where(
					and(
						eq(projects.id, input.projectId),
						eq(projects.userId, authUserId),
						isNull(projects.archivedAt)
					)
				)
				.limit(1);

			if (!projectRow) {
				throw new Error("Project not found.");
			}

			const assignedKey = await assignApiKeyToProject(context.db, {
				userId: authUserId,
				projectId: projectRow.id,
				apiKeyId: input.apiKeyId,
			});

			return {
				projectId: projectRow.id,
				apiKey: {
					...assignedKey,
					assignedProjectName: projectRow.name,
					assignmentStatus: "assigned" as const,
				},
			};
		}),
};
