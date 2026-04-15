import { randomBytes, scryptSync } from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS = {
	N: 16_384,
	r: 8,
	p: 1,
	maxmem: 64 * 1024 * 1024,
} as const;

export const API_KEY_PREFIX = "wh_" as const;

export const generateApiKeySecretPart = (): string =>
	randomBytes(24).toString("base64url");

export const hashApiKeySecret = (
	secretPart: string
): {
	hashB64: string;
	saltB64: string;
} => {
	const salt = randomBytes(16);
	const hash = scryptSync(secretPart, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS);

	return {
		saltB64: salt.toString("base64url"),
		hashB64: hash.toString("base64url"),
	};
};

export const formatApiKeyDisplaySuffix = (secretPart: string): string => {
	const tail = secretPart.slice(-4);
	return tail.length === 4 ? tail : secretPart.slice(0, 4).padStart(4, "0");
};

export const formatApiKeyDisplayLabel = (
	id: string,
	secretDisplaySuffix: string
): string => {
	const short = id.split("-")[0] ?? id.slice(0, 8);
	return `${API_KEY_PREFIX}${short}…${secretDisplaySuffix}`;
};
