/** Extract the base32 `secret` from an otpauth:// TOTP URI for manual entry. */
export function extractTotpSecret(uri: string): string | null {
	const match = uri.match(/[?&]secret=([^&]+)/i);
	if (!match) {
		return null;
	}
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return null;
	}
}
