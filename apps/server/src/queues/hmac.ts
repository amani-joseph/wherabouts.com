/** Sign a payload body with HMAC-SHA256. Pure utility — no external deps. */
export async function hmacSign(secret: string, body: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
	return `hmac-sha256=${Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")}`;
}
