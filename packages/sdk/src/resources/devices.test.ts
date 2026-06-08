import { describe, expect, it, vi } from "vitest";
import { createDevices } from "./devices.ts";

function fakeRequest() {
	return vi.fn((_opts: unknown): Promise<unknown> => Promise.resolve({}));
}

describe("createDevices", () => {
	describe("pushLocation", () => {
		it("calls POST /api/v1/devices/{deviceId}/location with body", async () => {
			const request = fakeRequest();
			const devices = createDevices(request as never);
			await devices.pushLocation("dev_1", { lat: -37.8, lng: 144.9 });
			expect(request).toHaveBeenCalledWith({
				method: "POST",
				path: "/api/v1/devices/dev_1/location",
				body: { lat: -37.8, lng: 144.9 },
			});
		});
	});

	describe("zones", () => {
		it("calls GET /api/v1/devices/{deviceId}/zones", async () => {
			const request = fakeRequest();
			const devices = createDevices(request as never);
			await devices.zones("dev_1");
			expect(request).toHaveBeenCalledWith({
				method: "GET",
				path: "/api/v1/devices/dev_1/zones",
			});
		});
	});
});
