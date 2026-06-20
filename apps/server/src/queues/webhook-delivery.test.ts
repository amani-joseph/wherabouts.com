import { describe, expect, it } from "vitest";
import { hmacSign } from "./hmac.ts";

const HMAC_SIGNATURE = /^hmac-sha256=[0-9a-f]{64}$/;

describe("hmacSign", () => {
	it("produces an hmac-sha256= prefixed 64-hex-char signature", async () => {
		const sig = await hmacSign("secret", "payload");
		expect(sig).toMatch(HMAC_SIGNATURE);
	});

	it("is deterministic for the same secret + body", async () => {
		const a = await hmacSign("mysecret", "body");
		const b = await hmacSign("mysecret", "body");
		expect(a).toBe(b);
	});

	it("differs for different secrets", async () => {
		const a = await hmacSign("secret1", "body");
		const b = await hmacSign("secret2", "body");
		expect(a).not.toBe(b);
	});

	it("differs for different bodies", async () => {
		const a = await hmacSign("secret", "body1");
		const b = await hmacSign("secret", "body2");
		expect(a).not.toBe(b);
	});
});
