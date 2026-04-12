import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Database } from "@wherabouts.com/database";
import { apiKeys, apiUsageDaily } from "@wherabouts.com/database/schema";
import { eq, sql } from "drizzle-orm";

const API_KEY_PREFIX = "wh_";
/** UUID v4 pattern (case-insensitive) */
const API_KEY_TOKEN_RE =
	/^wh_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_(.+)$/i;

const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS = {
	N: 16_384,
	r: 8,
	p: 1,
	maxmem: 64 * 1024 * 1024,
} as const;

export function parseApiKeyFromRequest(request: Request): string | null {
	const auth = request.headers.get("Authorization");
	if (auth?.startsWith("Bearer ")) {
		const token = auth.slice("Bearer ".length).trim();
		if (token.length > 0) {
			return token;
		}
	}
	const headerKey = request.headers.get("X-API-Key");
	if (headerKey) {
		const trimmed = headerKey.trim();
		if (trimmed.length > 0) {
			return trimmed;
		}
	}
	return null;
}

export interface ValidatedApiKey {
	apiKeyId: string;
	clerkUserId: string;
}

export async function validateApiKey(
	db: Database,
	token: string
): Promise<ValidatedApiKey | null> {
	const match = API_KEY_TOKEN_RE.exec(token);
	if (!match) {
		return null;
	}
	const keyId = match[1];
	const secretPart = match[2];
	if (!(keyId && secretPart)) {
		return null;
	}

	const rows = await db
		.select()
		.from(apiKeys)
		.where(eq(apiKeys.id, keyId))
		.limit(1);

	const row = rows[0];
	if (!row || row.revokedAt) {
		return null;
	}

	let saltBuf: Buffer;
	let storedHashBuf: Buffer;
	try {
		saltBuf = Buffer.from(row.secretSalt, "base64url");
		storedHashBuf = Buffer.from(row.secretHash, "base64url");
	} catch {
		return null;
	}

	if (saltBuf.length === 0 || storedHashBuf.length === 0) {
		return null;
	}

	let derived: Buffer;
	try {
		derived = scryptSync(
			secretPart,
			saltBuf,
			storedHashBuf.length,
			SCRYPT_OPTIONS
		);
	} catch {
		return null;
	}

	if (
		derived.length !== storedHashBuf.length ||
		!timingSafeEqual(derived, storedHashBuf)
	) {
		return null;
	}

	const now = new Date();
	await db
		.update(apiKeys)
		.set({ lastUsedAt: now })
		.where(eq(apiKeys.id, keyId));

	return { apiKeyId: keyId, clerkUserId: row.clerkUserId };
}

function todayUtcDateString(): string {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export async function recordUsage(
	db: Database,
	input: {
		apiKeyId: string;
		clerkUserId: string;
		endpoint: string;
	}
): Promise<void> {
	const usageDate = todayUtcDateString();
	await db
		.insert(apiUsageDaily)
		.values({
			apiKeyId: input.apiKeyId,
			clerkUserId: input.clerkUserId,
			usageDate,
			endpoint: input.endpoint,
			requestCount: 1,
		})
		.onConflictDoUpdate({
			target: [
				apiUsageDaily.apiKeyId,
				apiUsageDaily.usageDate,
				apiUsageDaily.endpoint,
			],
			set: {
				requestCount: sql`${apiUsageDaily.requestCount} + 1`,
			},
		});
}

export function hashApiKeySecret(secretPart: string): {
	saltB64: string;
	hashB64: string;
} {
	const salt = randomBytes(16);
	const hash = scryptSync(secretPart, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS);
	return {
		saltB64: salt.toString("base64url"),
		hashB64: hash.toString("base64url"),
	};
}

export function generateApiKeySecretPart(): string {
	return randomBytes(24).toString("base64url");
}

export function formatApiKeyDisplaySuffix(secretPart: string): string {
	const tail = secretPart.slice(-4);
	return tail.length === 4 ? tail : secretPart.slice(0, 4).padStart(4, "0");
}

export { API_KEY_PREFIX };
