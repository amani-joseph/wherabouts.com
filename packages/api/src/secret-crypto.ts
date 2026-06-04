import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const KEY_HEX_LENGTH = 64; // 32 bytes
const KEY_HEX_PATTERN = /^[0-9a-fA-F]+$/;

function getKey(): Buffer {
	const hex = process.env.KEY_ENC_KEY;
	if (!hex) {
		throw new Error("KEY_ENC_KEY environment variable is not set.");
	}
	if (hex.length !== KEY_HEX_LENGTH || !KEY_HEX_PATTERN.test(hex)) {
		throw new Error("KEY_ENC_KEY must be exactly 64 hex characters (32 bytes).");
	}
	return Buffer.from(hex, "hex");
}

/** Encrypt a secret to a single string: `iv:authTag:ciphertext` (hex). */
export function encryptSecret(plaintext: string): string {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, getKey(), iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();
	return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt a string produced by `encryptSecret`. Throws on tamper or bad format. */
export function decryptSecret(encoded: string): string {
	const [ivHex, authTagHex, encryptedHex] = encoded.split(":");
	if (!(ivHex && authTagHex && encryptedHex)) {
		throw new Error("Invalid ciphertext format");
	}
	const decipher = createDecipheriv(
		ALGORITHM,
		getKey(),
		Buffer.from(ivHex, "hex"),
		{ authTagLength: AUTH_TAG_LENGTH }
	);
	decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
	const decrypted = Buffer.concat([
		decipher.update(Buffer.from(encryptedHex, "hex")),
		decipher.final(),
	]);
	return decrypted.toString("utf8");
}

/** Generate a 32-byte random secret as hex (for webhook HMAC signing). */
export function generateWebhookSecret(): string {
	return randomBytes(32).toString("hex");
}
