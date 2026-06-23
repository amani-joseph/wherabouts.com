import { UAParser } from "ua-parser-js";

export type ParsedUserAgent = {
	device: string;
	browser: string;
	os: string;
};

const UNKNOWN: ParsedUserAgent = {
	device: "Unknown",
	browser: "Unknown",
	os: "Unknown",
};

/** Parse a session user-agent string into human-readable device/browser/os. */
export function parseUserAgent(
	ua: string | null | undefined
): ParsedUserAgent {
	if (!ua) {
		return UNKNOWN;
	}
	const parsed = new UAParser(ua).getResult();
	const deviceType = parsed.device.type;
	let device = "Desktop";
	if (deviceType === "mobile") {
		device = "Mobile";
	} else if (deviceType === "tablet") {
		device = "Tablet";
	}
	const browser = parsed.browser.name
		? `${parsed.browser.name}${parsed.browser.version ? ` ${parsed.browser.version.split(".")[0]}` : ""}`
		: "Unknown";
	const os = parsed.os.name
		? `${parsed.os.name}${parsed.os.version ? ` ${parsed.os.version}` : ""}`
		: "Unknown";
	return { device, browser, os };
}
