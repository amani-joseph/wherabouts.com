import { describe, expect, it } from "vitest";
import { validateWebhookUrl } from "./webhook-url.ts";

describe("validateWebhookUrl", () => {
	it("accepts a normal public https URL", () => {
		expect(validateWebhookUrl("https://example.com/hook")).toBeNull();
		expect(
			validateWebhookUrl("https://example.com/hook", { requireHttps: true })
		).toBeNull();
	});

	it("accepts hostnames that merely start with f-prefixes (not IPv6)", () => {
		expect(validateWebhookUrl("https://fcbarcelona.com")).toBeNull();
		expect(validateWebhookUrl("https://fd-cdn.example.org")).toBeNull();
	});

	it("rejects non-http(s) schemes", () => {
		expect(validateWebhookUrl("ftp://example.com")).not.toBeNull();
		expect(validateWebhookUrl("file:///etc/passwd")).not.toBeNull();
	});

	it("enforces https only when requireHttps is set", () => {
		expect(validateWebhookUrl("http://example.com")).toBeNull();
		expect(
			validateWebhookUrl("http://example.com", { requireHttps: true })
		).not.toBeNull();
	});

	it("rejects malformed URLs", () => {
		expect(validateWebhookUrl("not a url")).not.toBeNull();
	});

	it("blocks loopback and localhost", () => {
		expect(validateWebhookUrl("https://localhost/x")).not.toBeNull();
		expect(validateWebhookUrl("https://api.localhost/x")).not.toBeNull();
		expect(validateWebhookUrl("https://127.0.0.1/x")).not.toBeNull();
		expect(validateWebhookUrl("https://127.5.5.5/x")).not.toBeNull();
		expect(validateWebhookUrl("https://[::1]/x")).not.toBeNull();
	});

	it("blocks private IPv4 ranges", () => {
		expect(validateWebhookUrl("https://10.0.0.1")).not.toBeNull();
		expect(validateWebhookUrl("https://192.168.1.1")).not.toBeNull();
		expect(validateWebhookUrl("https://172.16.0.1")).not.toBeNull();
		expect(validateWebhookUrl("https://172.31.255.255")).not.toBeNull();
		expect(validateWebhookUrl("https://100.64.0.1")).not.toBeNull();
	});

	it("blocks the cloud metadata address (169.254.169.254)", () => {
		expect(
			validateWebhookUrl("https://169.254.169.254/latest/meta-data")
		).not.toBeNull();
	});

	it("blocks IPv6 unique-local / link-local and IPv4-mapped private", () => {
		expect(validateWebhookUrl("https://[fc00::1]")).not.toBeNull();
		expect(validateWebhookUrl("https://[fe80::1]")).not.toBeNull();
		expect(validateWebhookUrl("https://[::ffff:10.0.0.1]")).not.toBeNull();
	});

	it("allows public IPv4 (172.32 is outside the private /12)", () => {
		expect(validateWebhookUrl("https://172.32.0.1")).toBeNull();
		expect(validateWebhookUrl("https://8.8.8.8")).toBeNull();
	});
});
