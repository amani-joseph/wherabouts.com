import { describe, expect, it } from "vitest";
import { extractTotpSecret } from "./totp-uri.ts";

describe("extractTotpSecret", () => {
	it("extracts the secret query param", () => {
		const uri =
			"otpauth://totp/Wherabouts:jo@x.com?secret=JBSWY3DPEHPK3PXP&issuer=Wherabouts";
		expect(extractTotpSecret(uri)).toBe("JBSWY3DPEHPK3PXP");
	});
	it("returns null when absent or malformed", () => {
		expect(extractTotpSecret("not-a-uri")).toBeNull();
		expect(extractTotpSecret("otpauth://totp/x?issuer=y")).toBeNull();
	});
});
