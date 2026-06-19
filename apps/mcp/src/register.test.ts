import { describe, expect, it, vi } from "vitest";
import { allTools, registerTools } from "./register.ts";

describe("tool registry", () => {
	it("collects all 18 v1 tools with unique names", () => {
		expect(allTools).toHaveLength(18);
		expect(new Set(allTools.map((t) => t.name)).size).toBe(18);
	});

	it("registerTools registers every tool and routes calls through getClient", async () => {
		const registered: Record<string, (args: unknown) => Promise<unknown>> = {};
		const server = {
			registerTool: (
				name: string,
				_cfg: unknown,
				cb: (a: unknown) => Promise<unknown>
			) => {
				registered[name] = cb;
			},
		} as never;
		const client = { zones: { list: vi.fn(async () => ({ zones: [] })) } };
		registerTools(server, () => client as never);
		// biome-ignore lint/style/noNonNullAssertion: test-only registry lookup
		await registered.list_zones!({});
		expect(client.zones.list).toHaveBeenCalled();
	});

	it("registerTools converts thrown SDK errors into isError results", async () => {
		const registered: Record<string, (args: unknown) => Promise<unknown>> = {};
		const server = {
			registerTool: (
				name: string,
				_cfg: unknown,
				cb: (a: unknown) => Promise<unknown>
			) => {
				registered[name] = cb;
			},
		} as never;
		const client = {
			zones: {
				list: vi.fn(async () => {
					throw new Error("boom");
				}),
			},
		};
		registerTools(server, () => client as never);
		// biome-ignore lint/style/noNonNullAssertion: test-only registry lookup
		const res = await registered.list_zones!({});
		expect((res as { isError?: boolean }).isError).toBe(true);
	});
});
