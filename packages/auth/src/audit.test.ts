import { describe, expect, it } from "vitest";
import { mapAuditAction } from "./audit.ts";

describe("mapAuditAction", () => {
	it("maps two-factor endpoints", () => {
		expect(mapAuditAction("/two-factor/enable")).toBe("two_factor.enable");
		expect(mapAuditAction("/two-factor/disable")).toBe("two_factor.disable");
		expect(mapAuditAction("/two-factor/verify-totp")).toBe("two_factor.verify");
		expect(mapAuditAction("/two-factor/generate-backup-codes")).toBe(
			"two_factor.regenerate_backup_codes"
		);
	});

	it("maps session + deletion endpoints", () => {
		expect(mapAuditAction("/revoke-session")).toBe("session.revoke");
		expect(mapAuditAction("/revoke-sessions")).toBe("session.revoke_all");
		expect(mapAuditAction("/revoke-other-sessions")).toBe(
			"session.revoke_others"
		);
		expect(mapAuditAction("/delete-user")).toBe("account.delete");
	});

	it("maps sign-in and ignores everything else", () => {
		expect(mapAuditAction("/sign-in/email")).toBe("auth.sign_in");
		expect(mapAuditAction("/get-session")).toBeNull();
		expect(mapAuditAction("/unknown")).toBeNull();
	});

	it("tolerates a leading base path", () => {
		expect(mapAuditAction("/api/auth/two-factor/enable")).toBe(
			"two_factor.enable"
		);
	});
});
