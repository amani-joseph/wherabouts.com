// ---------------------------------------------------------------------------
// SSRF guard for user-supplied webhook URLs.
//
// Webhook subscription URLs are caller-controlled and the server POSTs to them
// from the worker, so an unvalidated URL turns the platform into an SSRF relay
// (e.g. http://127.0.0.1, http://169.254.169.254/...). This validates the URL
// scheme and blocks private / loopback / link-local / metadata address ranges.
//
// Pure (no env/db imports) so it can be unit-tested and reused at both create
// time (strict: requireHttps) and delivery time (defense-in-depth re-check).
//
// NOTE: this is a string/literal check. It does not resolve DNS, so a hostname
// that resolves to a private IP (DNS rebinding) is not fully caught here — that
// requires IP pinning at fetch time, which the Workers runtime does not expose.
// The delivery-time re-check still blocks private *literals* and legacy rows.
// ---------------------------------------------------------------------------

function isBlockedIpv4(host: string): boolean {
	const parts = host.split(".").map(Number);
	if (
		parts.length !== 4 ||
		parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)
	) {
		return true; // malformed numeric host — reject to be safe
	}
	const [a, b] = parts as [number, number, number, number];
	if (a === 0 || a === 10 || a === 127) {
		return true; // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8 (loopback)
	}
	if (a === 169 && b === 254) {
		return true; // 169.254.0.0/16 link-local + cloud metadata
	}
	if (a === 192 && b === 168) {
		return true; // 192.168.0.0/16
	}
	if (a === 172 && b >= 16 && b <= 31) {
		return true; // 172.16.0.0/12
	}
	if (a === 100 && b >= 64 && b <= 127) {
		return true; // 100.64.0.0/10 CGNAT
	}
	if (a >= 224) {
		return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
	}
	return false;
}

const IPV6_UNIQUE_LOCAL = /^f[cd]/; // fc00::/7
const IPV6_LINK_LOCAL = /^fe[89ab]/; // fe80::/10
const IPV4_LITERAL = /^\d{1,3}(\.\d{1,3}){3}$/;

function isBlockedIpv6(host: string): boolean {
	if (host === "::1" || host === "::") {
		return true; // loopback, unspecified
	}
	// IPv4-mapped IPv6 (e.g. ::ffff:10.0.0.1, normalized to ::ffff:a00:1).
	// No legitimate webhook target uses this notation — block the whole range.
	if (host.startsWith("::ffff:")) {
		return true;
	}
	if (IPV6_UNIQUE_LOCAL.test(host)) {
		return true; // fc00::/7 unique-local
	}
	if (IPV6_LINK_LOCAL.test(host)) {
		return true; // fe80::/10 link-local
	}
	return false;
}

function isBlockedHost(host: string): boolean {
	if (host === "localhost" || host.endsWith(".localhost")) {
		return true;
	}
	if (host.includes(":")) {
		return isBlockedIpv6(host);
	}
	if (IPV4_LITERAL.test(host)) {
		return isBlockedIpv4(host);
	}
	return false; // a DNS name — allowed (delivery-time re-check guards legacy/literals)
}

/**
 * Validate a user-supplied webhook URL. Returns `null` when the URL is safe to
 * use, or a human-readable rejection reason otherwise.
 *
 * @param requireHttps enforce an `https://` scheme (use at subscription create
 *   time). Delivery-time re-checks pass `false` so legacy `http://` rows still
 *   deliver but private/internal targets are always blocked.
 */
export function validateWebhookUrl(
	raw: string,
	{ requireHttps = false }: { requireHttps?: boolean } = {}
): string | null {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return "Invalid webhook URL.";
	}
	if (requireHttps && url.protocol !== "https:") {
		return "Webhook URL must use https.";
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		return "Webhook URL must use http or https.";
	}
	const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
	if (isBlockedHost(host)) {
		return "Webhook URL must not target a private, loopback, or internal address.";
	}
	return null;
}
