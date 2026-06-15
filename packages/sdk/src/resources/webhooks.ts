import type { CallOptions, Requester } from "../shared-types.ts";

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

/** Shape of the JSON body POSTed to your webhook endpoint when a device enters a zone. */
export interface WebhookEntryPayload {
	device: { id: string; lat: number; lng: number };
	event: "entry";
	timestamp: string;
	zone: { id: number; name: string };
}

/** Shape of the JSON body POSTed to your webhook endpoint when a device exits a zone. */
export interface WebhookExitPayload {
	device: { id: string; lat: number; lng: number };
	event: "exit";
	timestamp: string;
	zone: { id: number; name: string };
}

/** Discriminated union of all inbound webhook event payloads. */
export type WebhookEventPayload = WebhookEntryPayload | WebhookExitPayload;

export interface WebhooksResource {
	create(
		body: CreateWebhookBody,
		options?: CallOptions
	): Promise<CreateWebhookResponse>;
	delete(id: number, options?: CallOptions): Promise<DeleteWebhookResponse>;
	list(options?: CallOptions): Promise<ListWebhooksResponse>;
	reactivate(
		id: number,
		options?: CallOptions
	): Promise<ReactivateWebhookResponse>;
}

export const createWebhooks = (request: Requester): WebhooksResource => ({
	create: (body, options) =>
		request<CreateWebhookResponse>({
			method: "POST",
			path: "/api/v1/webhooks",
			body,
			...options,
		}),
	list: (options) =>
		request<ListWebhooksResponse>({
			method: "GET",
			path: "/api/v1/webhooks",
			...options,
		}),
	delete: (id, options) =>
		request<DeleteWebhookResponse>({
			method: "DELETE",
			path: `/api/v1/webhooks/${id}`,
			...options,
		}),
	reactivate: (id, options) =>
		request<ReactivateWebhookResponse>({
			method: "POST",
			path: `/api/v1/webhooks/${id}/reactivate`,
			...options,
		}),
});
