import { describe, expect, it, vi } from "vitest";
import { createZones } from "./zones.ts";

function fakeRequest() {
	return vi.fn((_opts: unknown): Promise<unknown> => Promise.resolve({}));
}

describe("createZones", () => {
	it("create — POST /api/v1/zones with body", async () => {
		const request = fakeRequest();
		const zones = createZones(request as never);
		const body = {
			name: "Test Zone",
			geometry: {
				type: "Polygon" as const,
				coordinates: [
					[
						[0, 0],
						[1, 0],
						[1, 1],
						[0, 1],
						[0, 0],
					],
				],
			},
		};
		await zones.create(body);
		expect(request).toHaveBeenCalledWith({
			method: "POST",
			path: "/api/v1/zones",
			body,
		});
	});

	it("list — GET /api/v1/zones with page/limit undefined", async () => {
		const request = fakeRequest();
		const zones = createZones(request as never);
		await zones.list();
		expect(request).toHaveBeenCalledWith({
			method: "GET",
			path: "/api/v1/zones",
			query: { page: undefined, limit: undefined },
		});
	});

	it("get — GET /api/v1/zones/7", async () => {
		const request = fakeRequest();
		const zones = createZones(request as never);
		await zones.get(7);
		expect(request).toHaveBeenCalledWith({
			method: "GET",
			path: "/api/v1/zones/7",
		});
	});

	it("update — PUT /api/v1/zones/7 with body", async () => {
		const request = fakeRequest();
		const zones = createZones(request as never);
		const body = { name: "Updated" };
		await zones.update(7, body);
		expect(request).toHaveBeenCalledWith({
			method: "PUT",
			path: "/api/v1/zones/7",
			body,
		});
	});

	it("delete — DELETE /api/v1/zones/7", async () => {
		const request = fakeRequest();
		const zones = createZones(request as never);
		await zones.delete(7);
		expect(request).toHaveBeenCalledWith({
			method: "DELETE",
			path: "/api/v1/zones/7",
		});
	});

	it("contains — GET /api/v1/zones/contains with lat/lng", async () => {
		const request = fakeRequest();
		const zones = createZones(request as never);
		await zones.contains({ lat: -33.8688, lng: 151.2093 });
		expect(request).toHaveBeenCalledWith({
			method: "GET",
			path: "/api/v1/zones/contains",
			query: { lat: -33.8688, lng: 151.2093 },
		});
	});

	it("addresses — GET /api/v1/zones/7/addresses with page/limit", async () => {
		const request = fakeRequest();
		const zones = createZones(request as never);
		await zones.addresses(7, { page: 2 });
		expect(request).toHaveBeenCalledWith({
			method: "GET",
			path: "/api/v1/zones/7/addresses",
			query: { page: 2, limit: undefined },
		});
	});

	it("paginate — yields all pages and stops when page is smaller than limit", async () => {
		const zone1 = { id: 1, name: "Zone 1" } as any;
		const zone2 = { id: 2, name: "Zone 2" } as any;
		const zone3 = { id: 3, name: "Zone 3" } as any;

		const request = vi.fn(async (opts: unknown): Promise<any> => {
			const req = opts as any;
			if (req.query.page === 1) {
				return { zones: [zone1, zone2] };
			}
			if (req.query.page === 2) {
				return { zones: [zone3] };
			}
			return { zones: [] };
		});

		const zones = createZones(request as never);
		const batches: any[] = [];

		for await (const batch of zones.paginate({ limit: 2 })) {
			batches.push(batch);
		}

		expect(batches).toHaveLength(2);
		expect(batches[0]).toEqual([zone1, zone2]);
		expect(batches[1]).toEqual([zone3]);
		expect(request).toHaveBeenCalledTimes(2);
		expect(request).toHaveBeenNthCalledWith(1, {
			method: "GET",
			path: "/api/v1/zones",
			query: { page: 1, limit: 2 },
		});
		expect(request).toHaveBeenNthCalledWith(2, {
			method: "GET",
			path: "/api/v1/zones",
			query: { page: 2, limit: 2 },
		});
	});
});
