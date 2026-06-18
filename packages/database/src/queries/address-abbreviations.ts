// Directionals are the ONLY abbreviation class that touches the indexed anchor
// (they sit between house number and street name), so we expand them into anchor
// variants. abbrev -> full and full -> abbrev both resolve to the same pair.
const DIRECTIONAL_PAIRS: [string, string][] = [
	["N", "NORTH"],
	["S", "SOUTH"],
	["E", "EAST"],
	["W", "WEST"],
	["NE", "NORTHEAST"],
	["NW", "NORTHWEST"],
	["SE", "SOUTHEAST"],
	["SW", "SOUTHWEST"],
];

const DIRECTIONAL_LOOKUP = new Map<string, [string, string]>();
for (const pair of DIRECTIONAL_PAIRS) {
	DIRECTIONAL_LOOKUP.set(pair[0], pair);
	DIRECTIONAL_LOOKUP.set(pair[1], pair);
}

export function isDirectional(token: string): boolean {
	return DIRECTIONAL_LOOKUP.has(token.trim().toUpperCase());
}

/** [abbrev, full] uppercase variants, or [token] when not a directional. */
export function directionalVariants(token: string): string[] {
	const pair = DIRECTIONAL_LOOKUP.get(token.trim().toUpperCase());
	return pair ? [pair[0], pair[1]] : [token.trim().toUpperCase()];
}

// Street/unit types affect ONLY reranking + the fuzzy-fallback string (the anchor
// stops before the type), so canonicalizing one direction (-> full word) is enough.
// "ST" is treated as Street, never Saint (design §4.3).
const STREET_TYPE_CANON: Record<string, string> = {
	rd: "ROAD",
	road: "ROAD",
	st: "STREET",
	street: "STREET",
	ave: "AVENUE",
	av: "AVENUE",
	avenue: "AVENUE",
	blvd: "BOULEVARD",
	boulevard: "BOULEVARD",
	dr: "DRIVE",
	drive: "DRIVE",
	ln: "LANE",
	lane: "LANE",
	ct: "COURT",
	court: "COURT",
	pl: "PLACE",
	place: "PLACE",
	hwy: "HIGHWAY",
	highway: "HIGHWAY",
	pde: "PARADE",
	parade: "PARADE",
	cres: "CRESCENT",
	crescent: "CRESCENT",
};

export function canonicalStreetType(token: string): string {
	const key = token.trim().toLowerCase();
	return STREET_TYPE_CANON[key] ?? token.trim().toUpperCase();
}
