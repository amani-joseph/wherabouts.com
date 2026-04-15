import { orpcClient } from "@/lib/orpc";

export interface ApiKeyListItem {
	assignedProjectId: string | null;
	assignedProjectName: string | null;
	assignmentStatus: "assigned" | "available";
	createdAt: string;
	displayLabel: string;
	id: string;
	lastUsedAt: string | null;
	name: string;
}

export const listApiKeys = async (): Promise<ApiKeyListItem[]> =>
	await orpcClient.apiKeys.list();

export interface CreateApiKeyResult {
	assignedProjectId: string | null;
	createdAt: string;
	displayLabel: string;
	id: string;
	key: string;
	lastUsedAt: null;
	name: string;
}

export const createApiKey = async (input: {
	data: {
		name: string;
	};
}): Promise<CreateApiKeyResult> =>
	await orpcClient.apiKeys.create({
		name: input.data.name,
	});

export const revokeApiKey = async (input: {
	data: {
		id: string;
	};
}): Promise<{ ok: true }> =>
	await orpcClient.apiKeys.revoke({
		id: input.data.id,
	});
