import { describe, expect, it, vi } from "vitest";
import { createWebhooks } from "./webhooks.ts";

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
});
