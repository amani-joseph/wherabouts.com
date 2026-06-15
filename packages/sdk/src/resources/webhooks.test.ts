import { describe, expect, it, vi } from "vitest";
import { createWebhooks, type WebhookEventPayload } from "./webhooks.ts";

function fakeRequest() {
	return vi.fn((_opts: unknown): Promise<unknown> => Promise.resolve({}));
}

describe("webhooks resource", () => {
	it("create() calls POST /api/v1/webhooks with body", async () => {
		const mock = fakeRequest();
		const webhooks = createWebhooks(mock as never);
		await webhooks.create({
			url: "https://example.com/hook",
			events: ["entry", "exit"],
		});
		expect(mock).toHaveBeenCalledWith({
			method: "POST",
			path: "/api/v1/webhooks",
			body: { url: "https://example.com/hook", events: ["entry", "exit"] },
		});
	});

	it("list() calls GET /api/v1/webhooks", async () => {
		const mock = fakeRequest();
		const webhooks = createWebhooks(mock as never);
		await webhooks.list();
		expect(mock).toHaveBeenCalledWith({
			method: "GET",
			path: "/api/v1/webhooks",
		});
	});

	it("delete(id) calls DELETE /api/v1/webhooks/:id", async () => {
		const mock = fakeRequest();
		const webhooks = createWebhooks(mock as never);
		await webhooks.delete(5);
		expect(mock).toHaveBeenCalledWith({
			method: "DELETE",
			path: "/api/v1/webhooks/5",
		});
	});

	it("reactivate(id) calls POST /api/v1/webhooks/:id/reactivate with no body", async () => {
		const mock = fakeRequest();
		const webhooks = createWebhooks(mock as never);
		await webhooks.reactivate(5);
		expect(mock).toHaveBeenCalledWith({
			method: "POST",
			path: "/api/v1/webhooks/5/reactivate",
		});
	});

	it("WebhookEventPayload discriminates on event field", () => {
		const entry: WebhookEventPayload = {
			event: "entry",
			device: { id: "dev_abc123", lat: -33.8688, lng: 151.2093 },
			zone: { id: 42, name: "Sydney CBD" },
			timestamp: "2026-06-15T00:00:00Z",
		};
		if (entry.event === "entry") {
			expect(entry.zone.id).toBe(42);
		}
		const exit: WebhookEventPayload = {
			event: "exit",
			device: { id: "dev_abc123", lat: -33.869, lng: 151.21 },
			zone: { id: 42, name: "Sydney CBD" },
			timestamp: "2026-06-15T00:00:01Z",
		};
		expect(exit.event).toBe("exit");
	});
});
