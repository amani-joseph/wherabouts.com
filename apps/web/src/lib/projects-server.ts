import { orpcClient } from "@/lib/orpc";
import type { ApiKeyListItem, CreateApiKeyResult } from "./api-keys-server";

export interface ProjectListItem {
	apiKey: ApiKeyListItem | null;
	createdAt: string;
	id: string;
	name: string;
	slug: string;
}

export interface CreateProjectResult extends ProjectListItem {
	generatedKey: CreateApiKeyResult | null;
}

export const listProjects = async (): Promise<ProjectListItem[]> =>
	await orpcClient.projects.list();

export const listProjectApiKeyOptions = async (): Promise<ApiKeyListItem[]> =>
	await orpcClient.projects.listApiKeyOptions();

export const createProject = async (input: {
	data: {
		name: string;
		selectedApiKeyId?: string;
	};
}): Promise<CreateProjectResult> =>
	await orpcClient.projects.create({
		name: input.data.name,
		selectedApiKeyId: input.data.selectedApiKeyId,
	});

export const assignProjectApiKey = async (input: {
	data: {
		apiKeyId: string;
		projectId: string;
	};
}): Promise<{
	apiKey: ApiKeyListItem;
	projectId: string;
}> =>
	await orpcClient.projects.assignApiKey({
		projectId: input.data.projectId,
		apiKeyId: input.data.apiKeyId,
	});
