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
});
