import { describe, expect, it, vi } from "vitest";
import { zoneManagementTools, zoneReadTools, zoneTools } from "./zones.ts";

const CONFIRM = /confirm/i;

const tool = (list: any[], name: string) => {
	const t = list.find((x) => x.name === name);
	if (!t) {
		throw new Error(`missing tool ${name}`);
	}
	return t;
};

describe("zone read tools", () => {
	it("registers four read-only tools", () => {
		expect(zoneReadTools.map((t) => t.name).sort()).toEqual([
			"get_zone",
			"list_zones",
			"zone_addresses",
			"zones_containing_point",
		]);
		for (const t of zoneReadTools) {
			expect(t.annotations?.readOnlyHint).toBe(true);
		}
	});

	it("list_zones calls zones.list with paging params", async () => {
		const list = vi.fn(async () => ({ zones: [], count: 0, page: 1 }));
		const client = { zones: { list } } as any;
		await tool(zoneReadTools, "list_zones").handler(client, {
			limit: 20,
			page: 2,
		});
		expect(list).toHaveBeenCalledWith({ limit: 20, page: 2 });
	});

	it("get_zone calls zones.get with numeric id", async () => {
		const get = vi.fn(async () => ({ id: 7 }));
		const client = { zones: { get } } as any;
		await tool(zoneReadTools, "get_zone").handler(client, { id: 7 });
		expect(get).toHaveBeenCalledWith(7);
	});

	it("zones_containing_point calls zones.contains", async () => {
		const contains = vi.fn(async () => ({ zones: [] }));
		const client = { zones: { contains } } as any;
		await tool(zoneReadTools, "zones_containing_point").handler(client, {
			lat: 1,
			lng: 2,
		});
		expect(contains).toHaveBeenCalledWith({ lat: 1, lng: 2 });
	});

	it("zone_addresses calls zones.addresses with id + paging", async () => {
		const addresses = vi.fn(async () => ({ addresses: [] }));
		const client = { zones: { addresses } } as any;
		await tool(zoneReadTools, "zone_addresses").handler(client, {
			id: 3,
			limit: 10,
		});
		expect(addresses).toHaveBeenCalledWith(3, { limit: 10 });
	});
});

describe("zone management tools", () => {
	const mgmtTool = (name: string) => {
		const t = zoneManagementTools.find((x) => x.name === name);
		if (!t) {
			throw new Error(`missing tool ${name}`);
		}
		return t;
	};

	it("zoneTools aggregates read + management (7 total)", () => {
		expect(zoneTools).toHaveLength(7);
	});

	it("management tools are flagged destructive, not read-only", () => {
		for (const t of zoneManagementTools) {
			expect(t.annotations?.destructiveHint).toBe(true);
			expect(t.annotations?.readOnlyHint).toBe(false);
		}
	});

	it("create_zone calls zones.create with the body", async () => {
		const create = vi.fn(async () => ({ id: 9 }));
		const client = { zones: { create } } as any;
		const body = { name: "Z", geometry: { type: "Polygon", coordinates: [] } };
		await mgmtTool("create_zone").handler(client, body);
		expect(create).toHaveBeenCalledWith(body);
	});

	it("update_zone calls zones.update with id and body", async () => {
		const update = vi.fn(async () => ({ id: 3 }));
		const client = { zones: { update } } as any;
		await mgmtTool("update_zone").handler(client, { id: 3, name: "NewName" });
		expect(update).toHaveBeenCalledWith(3, { name: "NewName" });
	});

	it("delete_zone refuses without confirm:true and does not call the API", async () => {
		const del = vi.fn();
		const client = { zones: { delete: del } } as any;
		const res = await mgmtTool("delete_zone").handler(client, { id: 5 });
		expect(res.isError).toBe(true);
		// biome-ignore lint/style/noNonNullAssertion: test assertion, content[0] guaranteed by handler
		expect(res.content[0]!.text).toMatch(CONFIRM);
		expect(del).not.toHaveBeenCalled();
	});

	it("delete_zone refuses when confirm:false and does not call the API", async () => {
		const del = vi.fn();
		const client = { zones: { delete: del } } as any;
		const res = await mgmtTool("delete_zone").handler(client, {
			id: 5,
			confirm: false,
		});
		expect(res.isError).toBe(true);
		expect(del).not.toHaveBeenCalled();
	});

	it("delete_zone calls zones.delete when confirm:true", async () => {
		const del = vi.fn(async () => ({ success: true }));
		const client = { zones: { delete: del } } as any;
		await mgmtTool("delete_zone").handler(client, { id: 5, confirm: true });
		expect(del).toHaveBeenCalledWith(5);
	});
});
