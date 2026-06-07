import { describe, expect, it } from "vitest";
import { computeBoundaryCrossings } from "./boundary-crossings.ts";

describe("computeBoundaryCrossings", () => {
	it("entry when device enters a new zone (prev [], curr [1])", () => {
		const result = computeBoundaryCrossings([], [1], { 1: "Zone A" });
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			zoneId: 1,
			zoneName: "Zone A",
			event: "entry",
		});
	});

	it("exit when device leaves (prev [1], curr [])", () => {
		const result = computeBoundaryCrossings([1], [], { 1: "Zone A" });
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ zoneId: 1, zoneName: "Zone A", event: "exit" });
	});

	it("simultaneous entry+exit (prev [1], curr [2]) → 2 crossings", () => {
		const result = computeBoundaryCrossings([1], [2], {
			1: "Zone A",
			2: "Zone B",
		});
		expect(result).toHaveLength(2);
		const entry = result.find((c) => c.event === "entry");
		const exit = result.find((c) => c.event === "exit");
		expect(entry).toEqual({ zoneId: 2, zoneName: "Zone B", event: "entry" });
		expect(exit).toEqual({ zoneId: 1, zoneName: "Zone A", event: "exit" });
	});

	it("no crossings when unchanged (prev [1,2], curr [1,2]) → []", () => {
		const result = computeBoundaryCrossings([1, 2], [1, 2], {
			1: "Zone A",
			2: "Zone B",
		});
		expect(result).toHaveLength(0);
	});

	it("first push treats all as entry (prev [], curr [1,3]) → 2 entries", () => {
		const result = computeBoundaryCrossings([], [1, 3], {
			1: "Zone A",
			3: "Zone C",
		});
		expect(result).toHaveLength(2);
		expect(result.every((c) => c.event === "entry")).toBe(true);
		const ids = result.map((c) => c.zoneId).sort();
		expect(ids).toEqual([1, 3]);
	});

	it("uses empty string for unknown zone name", () => {
		const result = computeBoundaryCrossings([], [99], {});
		expect(result[0]?.zoneName).toBe("");
	});
});
