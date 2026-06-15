/**
 * Generate a session token for grouping a run of autocomplete keystrokes into
 * one billable search (cf. Google Places session tokens). Create one per search
 * (e.g. on input focus), pass it on every `addresses.autocomplete` call for that
 * search, and discard it once the user selects a result.
 *
 * Uses `crypto.randomUUID()` where available, with a non-cryptographic fallback
 * (a token only needs to be unique per search, not unguessable).
 */
export function newSessionToken(): string {
	const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
	if (c && typeof c.randomUUID === "function") {
		return c.randomUUID();
	}
	return `wst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
