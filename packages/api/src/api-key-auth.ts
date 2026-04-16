import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Database } from "@wherabouts.com/database";
import { apiKeys, apiUsageDaily } from "@wherabouts.com/database/schema";
import { eq, sql } from "drizzle-orm";

export const API_KEY_PREFIX = "wh_" as const;
export const INTERNAL_API_AUTH_HEADER = "x-wherabouts-internal-auth";
export const INTERNAL_API_KEY_ID_HEADER = "x-wherabouts-internal-api-key-id";
export const INTERNAL_REQUEST_SOURCE_HEADER = "x-wherabouts-request-source";
export const REQUEST_SOURCE_PRODUCTION = "production";
export const REQUEST_SOURCE_EXPLORER_TEST = "explorer_test";

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
const LAST_USED_WRITE_INTERVAL_MINUTES = 30;

export interface ValidatedApiKey {
	apiKeyId: string;
	projectId: string | null;
	userId: string;
}

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

const isApiKeyExpired = (expiresAt: Date | null): boolean => {
	if (!expiresAt) {
		return false;
	}
	return expiresAt.getTime() <= Date.now();
};

async function touchLastUsedAt(db: Database, keyId: string): Promise<void> {
	await db.execute(sql`
		UPDATE api_keys
		SET last_used_at = now()
		WHERE id = ${keyId}
		  AND (
		    last_used_at IS NULL
		    OR last_used_at < now() - make_interval(mins => ${LAST_USED_WRITE_INTERVAL_MINUTES})
		  )
	`);
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
	if (!row || row.revokedAt || isApiKeyExpired(row.expiresAt)) {
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

	await touchLastUsedAt(db, keyId);

	return { apiKeyId: keyId, projectId: row.projectId, userId: row.userId };
}

export async function validateApiKeyById(
	db: Database,
	keyId: string
): Promise<ValidatedApiKey | null> {
	const rows = await db
		.select({
			id: apiKeys.id,
			expiresAt: apiKeys.expiresAt,
			projectId: apiKeys.projectId,
			userId: apiKeys.userId,
			revokedAt: apiKeys.revokedAt,
		})
		.from(apiKeys)
		.where(eq(apiKeys.id, keyId))
		.limit(1);

	const row = rows[0];
	if (!row || row.revokedAt || isApiKeyExpired(row.expiresAt)) {
		return null;
	}

	await touchLastUsedAt(db, keyId);

	return { apiKeyId: row.id, projectId: row.projectId, userId: row.userId };
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
		projectId?: string | null;
		userId: string;
		endpoint: string;
		requestSource?: string;
	}
): Promise<void> {
	const usageDate = todayUtcDateString();
	await db
		.insert(apiUsageDaily)
		.values({
			apiKeyId: input.apiKeyId,
			projectId: input.projectId ?? null,
			userId: input.userId,
			usageDate,
			endpoint: input.endpoint,
			requestSource: input.requestSource ?? REQUEST_SOURCE_PRODUCTION,
			requestCount: 1,
		})
		.onConflictDoUpdate({
			target: [
				apiUsageDaily.apiKeyId,
				apiUsageDaily.usageDate,
				apiUsageDaily.endpoint,
				apiUsageDaily.requestSource,
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

export function formatApiKeyDisplayLabel(
	id: string,
	secretDisplaySuffix: string
): string {
	const short = id.split("-")[0] ?? id.slice(0, 8);
	return `${API_KEY_PREFIX}${short}…${secretDisplaySuffix}`;
}
