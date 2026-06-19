import { WheraboutsApiError } from "@wherabouts/sdk";
import { describe, expect, it } from "vitest";
import { ok, toToolError } from "./errors.ts";

describe("ok", () => {
	it("wraps data as a JSON text block", () => {
		expect(ok({ a: 1 })).toEqual({
			content: [{ type: "text", text: '{"a":1}' }],
		});
	});
});

describe("toToolError", () => {
	const make = (status: number, message: string) =>
		new WheraboutsApiError({ message, status });

	it("maps 429 to a rate-limit message", () => {
		const r = toToolError(make(429, "slow down"));
		expect(r.isError).toBe(true);
		expect(r.content[0]!.text).toMatch(/rate.?limit/i);
	});

	it("maps 401 to an auth message", () => {
		expect(toToolError(make(401, "bad key")).content[0]!.text).toMatch(
			/auth|api key/i
		);
	});

	it("maps 5xx to a generic upstream error without leaking internals", () => {
		const r = toToolError(make(500, "stack trace here"));
		expect(r.content[0]!.text).toMatch(/upstream|temporarily/i);
		expect(r.content[0]!.text).not.toContain("stack trace here");
	});

	it("handles non-API errors", () => {
		const r = toToolError(new Error("boom"));
		expect(r.isError).toBe(true);
		expect(r.content[0]!.text).toContain("boom");
	});
});
