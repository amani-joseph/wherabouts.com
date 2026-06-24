const SECRET_PARAM_REGEX = /[?&]secret=([^&]+)/i;

/** Extract the base32 `secret` from an otpauth:// TOTP URI for manual entry. */
export function extractTotpSecret(uri: string): string | null {
	const match = uri.match(SECRET_PARAM_REGEX);
	if (!match) {
		return null;
	}
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return null;
	}
}
