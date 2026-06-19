import { describe, expect, it, vi } from "vitest";
import { zoneReadTools } from "./zones.ts";

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
