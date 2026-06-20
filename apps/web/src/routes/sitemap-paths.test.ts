import { describe, expect, it } from "vitest";
import { PUBLIC_PATHS } from "./sitemap[.]xml.ts";

describe("PUBLIC_PATHS", () => {
	it("includes the docs page", () => {
		expect(PUBLIC_PATHS.some((p) => p.path === "/docs")).toBe(true);
	});

	it("includes the pricing page", () => {
		expect(PUBLIC_PATHS.some((p) => p.path === "/pricing")).toBe(true);
	});

	it("includes the coverage page", () => {
		expect(PUBLIC_PATHS.some((p) => p.path === "/coverage")).toBe(true);
	});

	it("gives every entry a non-empty priority", () => {
		for (const entry of PUBLIC_PATHS) {
			expect(entry.priority.length).toBeGreaterThan(0);
		}
	});
});
