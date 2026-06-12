// Mirrors RAW_KEY_FORMAT_RE in packages/api/src/routers/domains/api-explorer.ts.
const RAW_KEY_FORMAT_RE = /^wh_[^_]+_.+$/i;

export interface SavedApiKey {
	displayLabel: string;
	id: string;
	name: string;
}

export type AuthInputResult =
	| { kind: "raw"; rawApiKey: string }
	| { kind: "filter"; matches: SavedApiKey[] };

export function detectAuthInput(
	text: string,
	keys: SavedApiKey[]
): AuthInputResult {
	const trimmed = text.trim();
	if (RAW_KEY_FORMAT_RE.test(trimmed)) {
		return { kind: "raw", rawApiKey: trimmed };
	}
	if (trimmed === "") {
		return { kind: "filter", matches: keys };
	}
	const needle = trimmed.toLowerCase();
	const matches = keys.filter(
		(k) =>
			k.name.toLowerCase().includes(needle) ||
			k.displayLabel.toLowerCase().includes(needle)
	);
	return { kind: "filter", matches };
}
