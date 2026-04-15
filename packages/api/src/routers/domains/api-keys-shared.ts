import { randomUUID } from "node:crypto";
import { apiKeys } from "@wherabouts.com/database";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
	API_KEY_PREFIX,
	formatApiKeyDisplayLabel,
	formatApiKeyDisplaySuffix,
	generateApiKeySecretPart,
	hashApiKeySecret,
} from "../../api-key-auth.ts";
import type { Context } from "../../context.ts";

type DatabaseLike = Context["db"];

export interface ActiveApiKeyRow {
	createdAt: Date;
	id: string;
	lastUsedAt: Date | null;
	name: string;
	projectId: string | null;
	secretDisplaySuffix: string;
}

export interface SerializedApiKey {
	assignedProjectId: string | null;
	assignedProjectName: string | null;
	assignmentStatus: "assigned" | "available";
	createdAt: string;
	displayLabel: string;
	id: string;
	lastUsedAt: string | null;
	name: string;
}

export interface CreatedApiKeyRecord {
	assignedProjectId: string | null;
	createdAt: string;
	displayLabel: string;
	id: string;
	key: string;
	lastUsedAt: null;
	name: string;
}

export const listActiveApiKeyRowsForUser = async (
	db: DatabaseLike,
	userId: string
): Promise<ActiveApiKeyRow[]> =>
	await db
		.select({
			id: apiKeys.id,
			name: apiKeys.name,
			secretDisplaySuffix: apiKeys.secretDisplaySuffix,
			projectId: apiKeys.projectId,
			createdAt: apiKeys.createdAt,
			lastUsedAt: apiKeys.lastUsedAt,
		})
		.from(apiKeys)
		.where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
		.orderBy(asc(apiKeys.createdAt));

export const serializeApiKey = (
	row: ActiveApiKeyRow,
	assignedProjectName: string | null = null
): SerializedApiKey => ({
	id: row.id,
	name: row.name,
	displayLabel: formatApiKeyDisplayLabel(row.id, row.secretDisplaySuffix),
	createdAt: row.createdAt.toISOString(),
	lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
	assignedProjectId: row.projectId,
	assignedProjectName,
	assignmentStatus: row.projectId ? "assigned" : "available",
});

export const createApiKeyRecord = async (
	db: DatabaseLike,
	input: {
		name: string;
		projectId?: string | null;
		userId: string;
	}
): Promise<CreatedApiKeyRecord> => {
	const id = randomUUID();
	const secretPart = generateApiKeySecretPart();
	const { saltB64, hashB64 } = hashApiKeySecret(secretPart);
	const secretDisplaySuffix = formatApiKeyDisplaySuffix(secretPart);
	const plaintextKey = `${API_KEY_PREFIX}${id}_${secretPart}`;
	const name = input.name.trim();

	await db.insert(apiKeys).values({
		id,
		userId: input.userId,
		name,
		projectId: input.projectId ?? null,
		secretHash: hashB64,
		secretSalt: saltB64,
		secretDisplaySuffix,
	});

	return {
		key: plaintextKey,
		id,
		name,
		displayLabel: formatApiKeyDisplayLabel(id, secretDisplaySuffix),
		createdAt: new Date().toISOString(),
		lastUsedAt: null,
		assignedProjectId: input.projectId ?? null,
	};
};
