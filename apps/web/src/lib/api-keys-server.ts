import { randomUUID } from "node:crypto";
import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { apiKeys } from "@wherabouts.com/database/schema";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
	formatApiKeyDisplaySuffix,
	generateApiKeySecretPart,
	hashApiKeySecret,
} from "@/lib/api-key-auth";
import { getDb } from "@/lib/db";

const API_KEY_PREFIX = "wh_" as const;

const createApiKeyInputSchema = z.object({
	name: z.string().min(1).max(128),
});

const revokeApiKeyInputSchema = z.object({
	id: z.string().uuid(),
});

export type ApiKeyListItem = {
	id: string;
	name: string;
	displayLabel: string;
	createdAt: string;
	lastUsedAt: string | null;
};

function formatDisplayLabel(id: string, secretDisplaySuffix: string): string {
	const short = id.split("-")[0] ?? id.slice(0, 8);
	return `${API_KEY_PREFIX}${short}…${secretDisplaySuffix}`;
}

export const listApiKeys = createServerFn({ method: "GET" }).handler(
	async (): Promise<ApiKeyListItem[]> => {
		const { userId } = await auth();
		if (!userId) {
			return [];
		}

		const db = getDb();
		const rows = await db
			.select({
				id: apiKeys.id,
				name: apiKeys.name,
				secretDisplaySuffix: apiKeys.secretDisplaySuffix,
				createdAt: apiKeys.createdAt,
				lastUsedAt: apiKeys.lastUsedAt,
			})
			.from(apiKeys)
			.where(and(eq(apiKeys.clerkUserId, userId), isNull(apiKeys.revokedAt)))
			.orderBy(apiKeys.createdAt);

		return rows.map((row) => ({
			id: row.id,
			name: row.name,
			displayLabel: formatDisplayLabel(row.id, row.secretDisplaySuffix),
			createdAt: row.createdAt.toISOString(),
			lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
		}));
	}
);

export type CreateApiKeyResult = {
	key: string;
	id: string;
	name: string;
	displayLabel: string;
	createdAt: string;
};

export const createApiKey = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createApiKeyInputSchema.parse(data))
	.handler(async ({ data }): Promise<CreateApiKeyResult> => {
		const { userId } = await auth();
		if (!userId) {
			throw new Error("Unauthorized");
		}

		const id = randomUUID();
		const secretPart = generateApiKeySecretPart();
		const { saltB64, hashB64 } = hashApiKeySecret(secretPart);
		const secretDisplaySuffix = formatApiKeyDisplaySuffix(secretPart);
		const plaintextKey = `${API_KEY_PREFIX}${id}_${secretPart}`;

		const db = getDb();
		await db.insert(apiKeys).values({
			id,
			clerkUserId: userId,
			name: data.name.trim(),
			secretHash: hashB64,
			secretSalt: saltB64,
			secretDisplaySuffix,
		});

		const createdAt = new Date();
		return {
			key: plaintextKey,
			id,
			name: data.name.trim(),
			displayLabel: formatDisplayLabel(id, secretDisplaySuffix),
			createdAt: createdAt.toISOString(),
		};
	});

export const revokeApiKey = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => revokeApiKeyInputSchema.parse(data))
	.handler(async ({ data }): Promise<{ ok: true }> => {
		const { userId } = await auth();
		if (!userId) {
			throw new Error("Unauthorized");
		}

		const db = getDb();
		const updated = await db
			.update(apiKeys)
			.set({ revokedAt: new Date() })
			.where(
				and(
					eq(apiKeys.id, data.id),
					eq(apiKeys.clerkUserId, userId),
					isNull(apiKeys.revokedAt)
				)
			)
			.returning({ id: apiKeys.id });

		if (updated.length === 0) {
			throw new Error("API key not found or already revoked");
		}

		return { ok: true };
	});
