import { describe, expect, it } from "vitest";
import { WheraboutsApiError } from "./errors.ts";
import {
	isClientError,
	isRateLimitError,
	isWheraboutsApiError,
} from "./guards.ts";

const apiError = (status: number, code?: WheraboutsApiError["code"]) =>
	new WheraboutsApiError({ status, code, message: "x" });

describe("isWheraboutsApiError", () => {
	it("is true for a WheraboutsApiError", () => {
		expect(isWheraboutsApiError(apiError(404, "not_found"))).toBe(true);
	});

	it("is false for a plain Error or non-error", () => {
		expect(isWheraboutsApiError(new Error("nope"))).toBe(false);
		expect(isWheraboutsApiError(null)).toBe(false);
		expect(isWheraboutsApiError({ foo: 1 })).toBe(false);
	});

	it("falls back to name+status duck-typing (duplicate-module safety)", () => {
		const dup = { name: "WheraboutsApiError", status: 500, message: "x" };
		expect(isWheraboutsApiError(dup)).toBe(true);
	});
});

describe("isRateLimitError", () => {
	it("is true for 429 or rate_limited", () => {
		expect(isRateLimitError(apiError(429))).toBe(true);
		expect(isRateLimitError(apiError(503, "rate_limited"))).toBe(true);
	});
	it("is false otherwise", () => {
		expect(isRateLimitError(apiError(500))).toBe(false);
		expect(isRateLimitError(new Error("x"))).toBe(false);
	});
});

describe("isClientError", () => {
	it("is true for 4xx, false for 5xx", () => {
		expect(isClientError(apiError(400))).toBe(true);
		expect(isClientError(apiError(404))).toBe(true);
		expect(isClientError(apiError(500))).toBe(false);
	});
});
