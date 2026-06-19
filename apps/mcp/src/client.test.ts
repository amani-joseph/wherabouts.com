import { describe, expect, it, vi } from "vitest";
import { buildClient } from "./client.ts";

describe("buildClient", () => {
	it("creates a client wired to the given baseUrl and apiKey", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ zones: [], count: 0, page: 1 }), {
					status: 200,
					headers: { "content-type": "application/json" },
				})
		);
		const client = buildClient("key_123", "https://api.example.com", fetchMock);
		await client.zones.list({});
		const [url, init] = fetchMock.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(String(url)).toContain("https://api.example.com/api/v1/zones");
		// SDK sends headers as a Headers instance with lowercase "authorization"
		const headers = init.headers as Headers;
		expect(headers.get("authorization")).toBe("Bearer key_123");
	});
});
