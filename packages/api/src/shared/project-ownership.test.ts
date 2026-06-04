import { ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { requireProjectOwnership } from "./project-ownership.ts";

function fakeDb(rows: Array<{ id: string }>) {
	return {
		select() {
			return {
				from() {
					return {
						where() {
							return { limit: async () => rows };
						},
					};
				},
			};
		},
	} as never;
}

describe("requireProjectOwnership", () => {
	it("resolves with the projectId when the user owns the project", async () => {
		const db = fakeDb([{ id: "proj-1" }]);
		await expect(
			requireProjectOwnership(db, "proj-1", "user-1")
		).resolves.toBe("proj-1");
	});

	it("throws NOT_FOUND when no matching project row exists", async () => {
		const db = fakeDb([]);
		await expect(
			requireProjectOwnership(db, "proj-x", "user-1")
		).rejects.toBeInstanceOf(ORPCError);
	});
});
