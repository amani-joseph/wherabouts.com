import { describe, expect, it, vi } from "vitest";
import { deviceTools } from "./devices.ts";

describe("device tools", () => {
	it("registers one read-only tool", () => {
		expect(deviceTools.map((t) => t.name)).toEqual(["device_zones"]);
		expect(deviceTools[0]?.annotations?.readOnlyHint).toBe(true);
	});

	it("device_zones calls devices.zones with the deviceId", async () => {
		const zones = vi.fn(async () => ({ deviceId: "d1", zones: [] }));
		const client = { devices: { zones } } as any;
		await deviceTools[0]?.handler(client, { deviceId: "d1" });
		expect(zones).toHaveBeenCalledWith("d1");
	});
});
