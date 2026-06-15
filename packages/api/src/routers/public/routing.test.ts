import { describe, expect, it } from "vitest";
import {
	buildMatchArrays,
	parseMatrixSides,
	resolveDirectionsInput,
	resolveMatrixPoints,
	resolveOptimizeWaypoint,
} from "./routing.ts";

/** Minimal chainable Drizzle stub whose `.limit()` resolves to `rows`. */
const mockDb = (rows: unknown[]): never => {
	const chain: Record<string, unknown> = {};
	for (const m of ["select", "from", "where"]) {
		chain[m] = () => chain;
	}
	chain.limit = () => Promise.resolve(rows);
	return chain as never;
};

describe("resolveDirectionsInput", () => {
	const db = {} as never;

	it("uses coords when from/to provided", async () => {
		const result = await resolveDirectionsInput(db, {
			from: "-37.8136,144.9631",
			to: "-33.8688,151.2093",
		});
		expect(result).toEqual({
			from: { lat: -37.8136, lng: 144.9631 },
			to: { lat: -33.8688, lng: 151.2093 },
		});
	});

	it("throws bad_request when neither coords nor addressId given for an endpoint", async () => {
		await expect(
			resolveDirectionsInput(db, { to: "-33.8688,151.2093" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("throws bad_request when both coords and addressId given", async () => {
		await expect(
			resolveDirectionsInput(db, {
				from: "-37.8,144.9",
				fromAddressId: 5,
				to: "-33.8,151.2",
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("throws bad_request on malformed coords", async () => {
		await expect(
			resolveDirectionsInput(db, { from: "nope", to: "-33.8,151.2" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("parseMatrixSides", () => {
	it("splits and trims both sides, dropping empties", () => {
		expect(parseMatrixSides("-37.8,144.9 | 512", "-33.8,151.2|")).toEqual({
			sourceItems: ["-37.8,144.9", "512"],
			destItems: ["-33.8,151.2"],
		});
	});

	it("throws bad_request when a side is empty", () => {
		expect(() => parseMatrixSides("", "-33.8,151.2")).toThrowError(
			expect.objectContaining({ code: "BAD_REQUEST" })
		);
	});

	it("throws bad_request when a side exceeds the per-side limit", () => {
		const tooMany = Array.from({ length: 26 }, () => "-37.8,144.9").join("|");
		expect(() => parseMatrixSides(tooMany, "-33.8,151.2")).toThrowError(
			expect.objectContaining({ code: "BAD_REQUEST" })
		);
	});
});

describe("resolveMatrixPoints", () => {
	it("parses 'lat,lng' items without touching the db", async () => {
		const points = await resolveMatrixPoints(mockDb([]), "sources", [
			"-37.8136,144.9631",
			"-33.8688,151.2093",
		]);
		expect(points).toEqual([
			{ lat: -37.8136, lng: 144.9631 },
			{ lat: -33.8688, lng: 151.2093 },
		]);
	});

	it("resolves a bare integer item as an address id", async () => {
		const points = await resolveMatrixPoints(
			mockDb([{ latitude: -37.81, longitude: 144.96 }]),
			"sources",
			["512"]
		);
		expect(points).toEqual([{ lat: -37.81, lng: 144.96 }]);
	});

	it("throws not_found when an address id does not resolve", async () => {
		await expect(
			resolveMatrixPoints(mockDb([]), "sources", ["999999"])
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("throws bad_request on an invalid point token", async () => {
		await expect(
			resolveMatrixPoints(mockDb([]), "sources", ["not-a-point"])
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("buildMatchArrays", () => {
	const p0 = { lat: -37.8136, lng: 144.9631 };
	const p1 = { lat: -37.81, lng: 144.97 };

	it("returns a bare trace when no timestamps/radiuses given", () => {
		expect(buildMatchArrays([p0, p1])).toEqual({
			trace: [p0, p1],
			timestamps: undefined,
			radiuses: undefined,
		});
	});

	it("splits per-point timestamp and radius into parallel arrays", () => {
		const result = buildMatchArrays([
			{ ...p0, timestamp: 1000, radius: 5 },
			{ ...p1, timestamp: 1005, radius: 8 },
		]);
		expect(result.timestamps).toEqual([1000, 1005]);
		expect(result.radiuses).toEqual([5, 8]);
		expect(result.trace).toEqual([p0, p1]);
	});

	it("throws bad_request when timestamps are not strictly increasing", () => {
		expect(() =>
			buildMatchArrays([
				{ ...p0, timestamp: 1005 },
				{ ...p1, timestamp: 1005 },
			])
		).toThrowError(expect.objectContaining({ code: "BAD_REQUEST" }));
	});

	it("throws bad_request when timestamp is present on some points only", () => {
		expect(() =>
			buildMatchArrays([{ ...p0, timestamp: 1000 }, p1])
		).toThrowError(expect.objectContaining({ code: "BAD_REQUEST" }));
	});

	it("throws bad_request when radius is present on some points only", () => {
		expect(() => buildMatchArrays([{ ...p0, radius: 5 }, p1])).toThrowError(
			expect.objectContaining({ code: "BAD_REQUEST" })
		);
	});
});

describe("resolveOptimizeWaypoint", () => {
	it("returns the lat/lng pair without touching the db", async () => {
		const coords = await resolveOptimizeWaypoint(mockDb([]), 0, {
			lat: -37.8136,
			lng: 144.9631,
		});
		expect(coords).toEqual({ lat: -37.8136, lng: 144.9631 });
	});

	it("resolves an addressId to coordinates", async () => {
		const coords = await resolveOptimizeWaypoint(
			mockDb([{ latitude: -37.81, longitude: 144.96 }]),
			1,
			{ addressId: 512 }
		);
		expect(coords).toEqual({ lat: -37.81, lng: 144.96 });
	});

	it("throws not_found when the addressId does not resolve", async () => {
		await expect(
			resolveOptimizeWaypoint(mockDb([]), 0, { addressId: 999_999 })
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("throws bad_request when both coords and addressId given", async () => {
		await expect(
			resolveOptimizeWaypoint(mockDb([]), 0, {
				lat: -37.8,
				lng: 144.9,
				addressId: 5,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("throws bad_request when neither coords nor addressId given", async () => {
		await expect(
			resolveOptimizeWaypoint(mockDb([]), 0, {})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
