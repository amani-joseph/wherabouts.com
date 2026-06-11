import { describe, expect, it } from "vitest";
import { billingOwnerFromKey, isInNewUtcMonth } from "./account.ts";

describe("billingOwnerFromKey", () => {
	it("uses team when the key has a teamId", () => {
		expect(
			billingOwnerFromKey({ teamId: "team-1", userId: "user-1" })
		).toEqual({ ownerType: "team", teamId: "team-1", userId: null });
	});

	it("falls back to user when no teamId", () => {
		expect(
			billingOwnerFromKey({ teamId: null, userId: "user-1" })
		).toEqual({ ownerType: "user", teamId: null, userId: "user-1" });
	});
});

describe("isInNewUtcMonth", () => {
	it("returns true when periodStart is null", () => {
		expect(isInNewUtcMonth(null, new Date("2026-06-11T00:00:00Z"))).toBe(true);
	});

	it("returns true when the month changed", () => {
		expect(isInNewUtcMonth("2026-05-31", new Date("2026-06-01T00:00:00Z"))).toBe(
			true
		);
	});

	it("returns false within the same month", () => {
		expect(isInNewUtcMonth("2026-06-01", new Date("2026-06-30T23:59:59Z"))).toBe(
			false
		);
	});
});
