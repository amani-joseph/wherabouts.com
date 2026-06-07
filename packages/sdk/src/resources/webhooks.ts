import type { Requester } from "../shared-types.ts";

export type WebhookEvent = "entry" | "exit";

export interface CreateWebhookBody {
	events?: WebhookEvent[];
	url: string;
	zoneId?: number;
}

export interface WebhookSubscription {
	active: boolean;
	createdAt: string;
	events: WebhookEvent[];
	id: number;
	url: string;
	zoneId: number | null;
}

export interface CreateWebhookResponse extends WebhookSubscription {
	secret: string;
}

export interface WebhookListItem extends WebhookSubscription {
	failing: boolean;
}

export interface ListWebhooksResponse {
	count: number;
	results: WebhookListItem[];
}

export interface DeleteWebhookResponse {
	deleted: true;
	id: number;
}

export interface ReactivateWebhookResponse {
	id: number;
	reactivated: true;
}

export interface WebhooksResource {
	create(body: CreateWebhookBody): Promise<CreateWebhookResponse>;
	delete(id: number): Promise<DeleteWebhookResponse>;
	list(): Promise<ListWebhooksResponse>;
	reactivate(id: number): Promise<ReactivateWebhookResponse>;
}

export const createWebhooks = (request: Requester): WebhooksResource => ({
	create: (body) =>
		request<CreateWebhookResponse>({
			method: "POST",
			path: "/api/v1/webhooks",
			body,
		}),
	list: () =>
		request<ListWebhooksResponse>({
			method: "GET",
			path: "/api/v1/webhooks",
		}),
	delete: (id) =>
		request<DeleteWebhookResponse>({
			method: "DELETE",
			path: `/api/v1/webhooks/${id}`,
		}),
	reactivate: (id) =>
		request<ReactivateWebhookResponse>({
			method: "POST",
			path: `/api/v1/webhooks/${id}/reactivate`,
		}),
});
