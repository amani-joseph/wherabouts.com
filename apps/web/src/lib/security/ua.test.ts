import { describe, expect, it } from "vitest";
import { parseUserAgent } from "./ua.ts";

const CHROME_MAC =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const SAFARI_IPHONE =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("parseUserAgent", () => {
	it("parses a desktop browser", () => {
		const r = parseUserAgent(CHROME_MAC);
		expect(r.browser).toContain("Chrome");
		expect(r.os).toContain("mac");
		expect(r.device).toBe("Desktop");
	});

	it("parses a mobile browser", () => {
		const r = parseUserAgent(SAFARI_IPHONE);
		expect(r.device).toBe("Mobile");
		expect(r.os).toContain("iOS");
	});

	it("falls back to Unknown for empty input", () => {
		expect(parseUserAgent(null)).toEqual({
			device: "Unknown",
			browser: "Unknown",
			os: "Unknown",
		});
	});
});
