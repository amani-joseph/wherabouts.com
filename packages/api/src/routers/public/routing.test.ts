import { describe, expect, it } from "vitest";
import {
	parseMatrixSides,
	resolveDirectionsInput,
	resolveMatrixPoints,
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
