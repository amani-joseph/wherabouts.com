import { describe, expect, it } from "vitest";
import { validateDeleteConfirmation } from "./delete-confirmation.ts";

const base = {
	typedEmail: "jo@x.com",
	accountEmail: "jo@x.com",
	password: "supersecret",
	twoFactorEnabled: false,
	totpCode: "",
};

describe("validateDeleteConfirmation", () => {
	it("passes when email matches and password present (no 2FA)", () => {
		expect(validateDeleteConfirmation(base).valid).toBe(true);
	});
	it("fails on email mismatch", () => {
		const r = validateDeleteConfirmation({ ...base, typedEmail: "no@x.com" });
		expect(r.valid).toBe(false);
		expect(r.errors.email).toBeDefined();
	});
	it("requires a password", () => {
		const r = validateDeleteConfirmation({ ...base, password: "" });
		expect(r.valid).toBe(false);
		expect(r.errors.password).toBeDefined();
	});
	it("requires a 6-digit code when 2FA is on", () => {
		const r = validateDeleteConfirmation({
			...base,
			twoFactorEnabled: true,
			totpCode: "123",
		});
		expect(r.valid).toBe(false);
		expect(r.errors.totpCode).toBeDefined();
	});
	it("passes with valid code when 2FA is on", () => {
		expect(
			validateDeleteConfirmation({
				...base,
				twoFactorEnabled: true,
				totpCode: "123456",
			}).valid
		).toBe(true);
	});
});
