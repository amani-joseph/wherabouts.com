import { describe, expect, it } from "vitest";
import { absoluteUrl, buildSeo, SITE_URL } from "./seo.ts";

describe("absoluteUrl", () => {
	it("joins a root-relative path onto SITE_URL", () => {
		expect(absoluteUrl("/docs")).toBe(`${SITE_URL}/docs`);
	});

	it("passes an already-absolute URL through unchanged", () => {
		expect(absoluteUrl("https://cdn.example.com/x.png")).toBe(
			"https://cdn.example.com/x.png"
		);
	});

	it("treats '/' as the site root", () => {
		expect(absoluteUrl("/")).toBe(`${SITE_URL}/`);
	});
});

describe("buildSeo", () => {
	const head = buildSeo({
		title: "Test Title",
		description: "Test description.",
		path: "/docs",
		keywords: "geocoding, api",
	});

	function metaContent(predicate: (m: Record<string, string>) => boolean) {
		return head.meta.find(predicate);
	}

	it("emits a title meta tag", () => {
		expect(metaContent((m) => m.title === "Test Title")).toBeTruthy();
	});

	it("emits a description meta tag", () => {
		const d = metaContent((m) => m.name === "description");
		expect(d?.content).toBe("Test description.");
	});

	it("emits a keywords meta tag only when provided", () => {
		expect(metaContent((m) => m.name === "keywords")?.content).toBe(
			"geocoding, api"
		);
		const noKeywords = buildSeo({
			title: "t",
			description: "d",
			path: "/",
		});
		expect(noKeywords.meta.find((m) => m.name === "keywords")).toBeUndefined();
	});

	it("emits an absolute canonical link", () => {
		const canonical = head.links.find((l) => l.rel === "canonical");
		expect(canonical?.href).toBe(`${SITE_URL}/docs`);
	});

	it("emits an absolute og:url", () => {
		expect(metaContent((m) => m.property === "og:url")?.content).toBe(
			`${SITE_URL}/docs`
		);
	});

	it("resolves a root-relative og:image to an absolute URL", () => {
		const img = metaContent((m) => m.property === "og:image")?.content;
		expect(img?.startsWith(`${SITE_URL}/`)).toBe(true);
	});

	it("uses the summary_large_image twitter card", () => {
		expect(metaContent((m) => m.name === "twitter:card")?.content).toBe(
			"summary_large_image"
		);
	});

	it("defaults og:type to website", () => {
		expect(metaContent((m) => m.property === "og:type")?.content).toBe(
			"website"
		);
	});
});
