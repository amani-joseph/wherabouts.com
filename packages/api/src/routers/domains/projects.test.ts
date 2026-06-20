import { describe, expect, it } from "vitest";
import { deleteProjectForUser } from "./projects.ts";

interface UpdateCall {
	set: Record<string, unknown>;
	table: "projects" | "apiKeys";
}

/**
 * Builds a fake db that returns the given project row from the ownership
 * lookup and records every `update(...).set(...)` so we can assert that
 * deletion archives the project and frees its API keys — without Postgres.
 */
function createMockDb(projectRow: { id: string } | null) {
	const updates: UpdateCall[] = [];
	let updateIndex = 0;

	const db = {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => Promise.resolve(projectRow ? [projectRow] : []),
				}),
			}),
		}),
		update: () => {
			// The handler frees API keys first, then archives the project.
			const table = updateIndex === 0 ? "apiKeys" : "projects";
			updateIndex += 1;
			return {
				set: (set: Record<string, unknown>) => {
					updates.push({ table, set });
					return { where: () => Promise.resolve() };
				},
			};
		},
	} as unknown as Parameters<typeof deleteProjectForUser>[0];

	return { db, updates };
}

describe("deleteProjectForUser", () => {
	it("frees the project's API keys and archives the project", async () => {
		const { db, updates } = createMockDb({ id: "project-1" });

		const result = await deleteProjectForUser(db, {
			projectId: "project-1",
			userId: "user-1",
		});

		expect(result).toEqual({ id: "project-1" });

		const keyUpdate = updates.find((u) => u.table === "apiKeys");
		expect(keyUpdate?.set).toEqual({ projectId: null });

		const projectUpdate = updates.find((u) => u.table === "projects");
		expect(projectUpdate?.set.archivedAt).toBeInstanceOf(Date);
	});

	it("throws when the project is missing or already archived", async () => {
		const { db, updates } = createMockDb(null);

		await expect(
			deleteProjectForUser(db, { projectId: "missing", userId: "user-1" })
		).rejects.toThrow("Project not found.");

		// Nothing should be mutated when ownership cannot be verified.
		expect(updates).toHaveLength(0);
	});
});
