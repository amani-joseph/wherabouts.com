# Freeform Address Input Normalizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse fully-formatted freeform addresses into components and match them via a lean structured query so international addresses (e.g. `1 Rocket Road, Hawthorne, CA 90250, United States`) return results, with a fuzzy fallback that preserves existing typeahead.

**Architecture:** New pure helpers in `packages/database/src/queries/` (country lookup, abbreviation maps, `parseFreeformAddress`, anchor builder) compose into a structured branch added to `autocompleteAddresses`. The structured query anchors on the existing `idx_addresses_search_text_btree` (`search_text LIKE '<num> <street>%'`), hard-filters on detected country, and reranks by postcode/locality/region. Zero rows → existing fuzzy path on the cleaned string. A light client-side cleanup in `packages/react-ui` strips commas for snappy typeahead.

**Tech Stack:** TypeScript, Drizzle ORM (`sql` template), Neon Postgres + pg_trgm, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-18-address-input-normalizer-design.md`

---

## File Structure

- Create `packages/database/src/queries/country-codes.ts` — country name/code → ISO-2 lookup.
- Create `packages/database/src/queries/country-codes.test.ts`.
- Create `packages/database/src/queries/address-abbreviations.ts` — directional variants + street-type canonicalization.
- Create `packages/database/src/queries/address-abbreviations.test.ts`.
- Create `packages/database/src/queries/parse-freeform-address.ts` — `parseFreeformAddress`.
- Create `packages/database/src/queries/parse-freeform-address.test.ts`.
- Create `packages/database/src/queries/structured-search.ts` — `buildAnchorPrefixes` (pure) + `structuredAutocomplete` (DB executor).
- Create `packages/database/src/queries/structured-search.test.ts` — covers `buildAnchorPrefixes`.
- Modify `packages/database/src/queries/autocomplete.ts` — add structured branch + cleaned-string fallback.
- Modify `packages/database/src/queries/index.ts` — export new public symbols.
- Modify `packages/react-ui/src/utils/parse-address.ts` — add `cleanAddressInput` client hint.
- Create `packages/react-ui/src/utils/parse-address.test.ts` — covers `cleanAddressInput`.

Run tests from the package root: `cd packages/database && pnpm test`. Single file: `pnpm vitest run src/queries/<file>.test.ts`.

---

### Task 1: Country lookup

**Files:**
- Create: `packages/database/src/queries/country-codes.ts`
- Test: `packages/database/src/queries/country-codes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/database/src/queries/country-codes.test.ts
import { describe, expect, it } from "vitest";
import { matchCountry } from "./country-codes.ts";

describe("matchCountry", () => {
	it("maps full names to ISO-2", () => {
		expect(matchCountry("United States")).toBe("US");
		expect(matchCountry("france")).toBe("FR");
		expect(matchCountry("Australia")).toBe("AU");
		expect(matchCountry("United Kingdom")).toBe("GB");
	});

	it("maps common aliases and bare codes", () => {
		expect(matchCountry("USA")).toBe("US");
		expect(matchCountry("UK")).toBe("GB");
		expect(matchCountry("US")).toBe("US");
		expect(matchCountry("  fr  ")).toBe("FR");
	});

	it("returns null for non-country text", () => {
		expect(matchCountry("Hawthorne")).toBeNull();
		expect(matchCountry("")).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/database && pnpm vitest run src/queries/country-codes.test.ts`
Expected: FAIL — cannot find module `./country-codes.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/database/src/queries/country-codes.ts

/**
 * Country name / alias / ISO code → ISO-2, scoped to the loaded countries
 * (AU + US + the intl ingest set). Exact, case-insensitive match only; no fuzzy
 * matching (a mis-detected country becomes a wrong hard filter). See design §4.2.
 */
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
	"united states": "US",
	"united states of america": "US",
	usa: "US",
	"u.s.": "US",
	"u.s.a.": "US",
	us: "US",
	australia: "AU",
	au: "AU",
	"united kingdom": "GB",
	"great britain": "GB",
	uk: "GB",
	gb: "GB",
	france: "FR",
	fr: "FR",
	germany: "DE",
	de: "DE",
	spain: "ES",
	es: "ES",
	italy: "IT",
	it: "IT",
	netherlands: "NL",
	nl: "NL",
	belgium: "BE",
	be: "BE",
	austria: "AT",
	at: "AT",
	switzerland: "CH",
	ch: "CH",
	portugal: "PT",
	pt: "PT",
	poland: "PL",
	pl: "PL",
	denmark: "DK",
	dk: "DK",
	norway: "NO",
	no: "NO",
	finland: "FI",
	fi: "FI",
	canada: "CA",
	ca: "CA",
};

export function matchCountry(text: string): string | null {
	return COUNTRY_NAME_TO_ISO[text.trim().toLowerCase()] ?? null;
}
```

Note: `ca → CA` (Canada) is intentional; `CA` as a US **state** is handled positionally
in `parseFreeformAddress` (region detection runs only on the trailing state+zip segment,
country detection only on the final segment), so the two never collide in practice.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/database && pnpm vitest run src/queries/country-codes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/queries/country-codes.ts packages/database/src/queries/country-codes.test.ts
git commit -m "feat(db): add country name/code -> ISO-2 lookup"
```

---

### Task 2: Abbreviation maps (directionals + street types)

**Files:**
- Create: `packages/database/src/queries/address-abbreviations.ts`
- Test: `packages/database/src/queries/address-abbreviations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/database/src/queries/address-abbreviations.test.ts
import { describe, expect, it } from "vitest";
import {
	canonicalStreetType,
	directionalVariants,
	isDirectional,
} from "./address-abbreviations.ts";

describe("directionalVariants", () => {
	it("returns both abbreviated and expanded forms (uppercase)", () => {
		expect(directionalVariants("N")).toEqual(["N", "NORTH"]);
		expect(directionalVariants("north")).toEqual(["N", "NORTH"]);
		expect(directionalVariants("SW")).toEqual(["SW", "SOUTHWEST"]);
	});

	it("returns the single token when not a directional", () => {
		expect(directionalVariants("ROCKET")).toEqual(["ROCKET"]);
	});
});

describe("isDirectional", () => {
	it("recognizes directional tokens case-insensitively", () => {
		expect(isDirectional("n")).toBe(true);
		expect(isDirectional("NORTH")).toBe(true);
		expect(isDirectional("Rocket")).toBe(false);
	});
});

describe("canonicalStreetType", () => {
	it("canonicalizes abbreviations and full forms to the full word", () => {
		expect(canonicalStreetType("Rd")).toBe("ROAD");
		expect(canonicalStreetType("road")).toBe("ROAD");
		expect(canonicalStreetType("ST")).toBe("STREET");
	});

	it("returns the uppercased token unchanged when unknown", () => {
		expect(canonicalStreetType("Rocket")).toBe("ROCKET");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/database && pnpm vitest run src/queries/address-abbreviations.test.ts`
Expected: FAIL — cannot find module `./address-abbreviations.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/database/src/queries/address-abbreviations.ts

// Directionals are the ONLY abbreviation class that touches the indexed anchor
// (they sit between house number and street name), so we expand them into anchor
// variants. abbrev -> full and full -> abbrev both resolve to the same pair.
const DIRECTIONAL_PAIRS: Array<[string, string]> = [
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/database && pnpm vitest run src/queries/address-abbreviations.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/queries/address-abbreviations.ts packages/database/src/queries/address-abbreviations.test.ts
git commit -m "feat(db): add directional + street-type abbreviation maps"
```

---

### Task 3: `parseFreeformAddress`

**Files:**
- Create: `packages/database/src/queries/parse-freeform-address.ts`
- Test: `packages/database/src/queries/parse-freeform-address.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/database/src/queries/parse-freeform-address.test.ts
import { describe, expect, it } from "vitest";
import { parseFreeformAddress } from "./parse-freeform-address.ts";

describe("parseFreeformAddress", () => {
	it("parses a full US address", () => {
		const r = parseFreeformAddress("1 Rocket Road, Hawthorne, CA 90250, United States");
		expect(r.houseNumber).toBe("1");
		expect(r.directional).toBeNull();
		expect(r.streetTokens).toEqual(["ROCKET", "ROAD"]);
		expect(r.locality).toBe("HAWTHORNE");
		expect(r.region).toBe("CA");
		expect(r.postcode).toBe("90250");
		expect(r.countryCode).toBe("US");
		expect(r.confidence).toBe("high");
	});

	it("captures a leading directional", () => {
		const r = parseFreeformAddress("1 N Rocket Rd, Hawthorne, CA 90250, US");
		expect(r.houseNumber).toBe("1");
		expect(r.directional).toBe("N");
		expect(r.streetTokens).toEqual(["ROCKET", "RD"]);
	});

	it("parses a UK postcode", () => {
		const r = parseFreeformAddress("10 Downing St, London, SW1A 2AA, UK");
		expect(r.houseNumber).toBe("10");
		expect(r.postcode).toBe("SW1A 2AA");
		expect(r.countryCode).toBe("GB");
		expect(r.locality).toBe("LONDON");
	});

	it("parses an AU address", () => {
		const r = parseFreeformAddress("120 Main St, Sydney, NSW 2000, Australia");
		expect(r.region).toBe("NSW");
		expect(r.postcode).toBe("2000");
		expect(r.countryCode).toBe("AU");
	});

	it("builds a cleaned string in stored order without commas or country name", () => {
		const r = parseFreeformAddress("1 Rocket Road, Hawthorne, CA 90250, United States");
		expect(r.cleaned).toBe("1 ROCKET ROAD HAWTHORNE CA 90250");
	});

	it("marks bare typeahead as low confidence", () => {
		const r = parseFreeformAddress("120 Mai");
		expect(r.confidence).toBe("low");
		expect(r.countryCode).toBeNull();
		expect(r.postcode).toBeNull();
	});

	it("handles missing house number", () => {
		const r = parseFreeformAddress("Rocket Road, Hawthorne, CA, US");
		expect(r.houseNumber).toBeNull();
		expect(r.countryCode).toBe("US");
	});

	it("handles a house-number range", () => {
		const r = parseFreeformAddress("1-3 Rocket Road, Hawthorne, CA 90250, US");
		expect(r.houseNumber).toBe("1-3");
		expect(r.streetTokens).toEqual(["ROCKET", "ROAD"]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/database && pnpm vitest run src/queries/parse-freeform-address.test.ts`
Expected: FAIL — cannot find module `./parse-freeform-address.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/database/src/queries/parse-freeform-address.ts
import { isDirectional } from "./address-abbreviations.ts";
import { matchCountry } from "./country-codes.ts";

export interface ParsedFreeformAddress {
	houseNumber: string | null;
	directional: string | null;
	streetTokens: string[];
	locality: string | null;
	region: string | null;
	postcode: string | null;
	countryCode: string | null;
	segments: string[];
	cleaned: string;
	confidence: "high" | "low";
}

// US ZIP, AU/EU 4-digit, UK, CA. Anchored fragments tried against a segment's tokens.
const POSTCODE_PATTERNS: RegExp[] = [
	/^\d{5}(?:-\d{4})?$/, // US
	/^\d{4}$/, // AU + much of EU
	/^[A-Z]\d[A-Z]$/, // CA outward (paired with a second token below)
];
const UK_OUTWARD = /^[A-Z]{1,2}\d[A-Z\d]?$/;
const UK_INWARD = /^\d[A-Z]{2}$/;
const HOUSE_NUMBER = /^\d+[A-Z]?(?:-\d+[A-Z]?)?$/;
// 2-letter US/AU region codes (rerank only; not exhaustive by design).
const REGION_CODES = new Set([
	"AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL",
	"IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
	"NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
	"SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
	"NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT",
]);

function extractPostcodeAndRegion(tokens: string[]): {
	postcode: string | null;
	region: string | null;
	rest: string[];
} {
	const rest = [...tokens];
	let postcode: string | null = null;
	let region: string | null = null;

	// UK: two-token "SW1A 2AA" at the end.
	if (rest.length >= 2) {
		const last = rest.at(-1) as string;
		const prev = rest.at(-2) as string;
		if (UK_INWARD.test(last) && UK_OUTWARD.test(prev)) {
			postcode = `${prev} ${last}`;
			rest.splice(rest.length - 2, 2);
		}
	}

	if (!postcode) {
		for (let i = rest.length - 1; i >= 0; i--) {
			if (POSTCODE_PATTERNS.some((re) => re.test(rest[i] as string))) {
				postcode = rest[i] as string;
				rest.splice(i, 1);
				break;
			}
		}
	}

	for (let i = rest.length - 1; i >= 0; i--) {
		if (REGION_CODES.has(rest[i] as string)) {
			region = rest[i] as string;
			rest.splice(i, 1);
			break;
		}
	}

	return { postcode, region, rest };
}

export function parseFreeformAddress(input: string): ParsedFreeformAddress {
	const upper = input.trim().toUpperCase();
	const rawSegments = upper
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

	const empty: ParsedFreeformAddress = {
		houseNumber: null,
		directional: null,
		streetTokens: [],
		locality: null,
		region: null,
		postcode: null,
		countryCode: null,
		segments: rawSegments,
		cleaned: upper,
		confidence: "low",
	};
	if (rawSegments.length === 0) {
		return empty;
	}

	const segments = [...rawSegments];

	// 1. Country — only from the final segment.
	let countryCode: string | null = null;
	const lastCountry = matchCountry(segments.at(-1) as string);
	if (lastCountry) {
		countryCode = lastCountry;
		segments.pop();
	}

	// 2. Postcode + region — only from the (new) trailing segment's tokens.
	let postcode: string | null = null;
	let region: string | null = null;
	if (segments.length > 0) {
		const tailTokens = (segments.at(-1) as string).split(/\s+/).filter(Boolean);
		const extracted = extractPostcodeAndRegion(tailTokens);
		postcode = extracted.postcode;
		region = extracted.region;
		if (extracted.rest.length === 0) {
			segments.pop();
		} else {
			segments[segments.length - 1] = extracted.rest.join(" ");
		}
	}

	// 3. Street segment = first remaining; locality = the rest joined.
	let houseNumber: string | null = null;
	let directional: string | null = null;
	let streetTokens: string[] = [];
	let locality: string | null = null;

	if (segments.length > 0) {
		const streetTokensRaw = (segments[0] as string).split(/\s+/).filter(Boolean);
		if (streetTokensRaw.length > 0 && HOUSE_NUMBER.test(streetTokensRaw[0] as string)) {
			houseNumber = streetTokensRaw.shift() as string;
		}
		if (streetTokensRaw.length > 0 && isDirectional(streetTokensRaw[0] as string)) {
			directional = streetTokensRaw.shift() as string;
		}
		streetTokens = streetTokensRaw;

		const localitySegments = segments.slice(1);
		if (localitySegments.length > 0) {
			locality = localitySegments.join(" ");
		}
	}

	const cleaned = [
		houseNumber,
		directional,
		...streetTokens,
		locality,
		region,
		postcode,
	]
		.filter(Boolean)
		.join(" ");

	const confidence: "high" | "low" =
		countryCode || postcode || rawSegments.length >= 2 ? "high" : "low";

	return {
		houseNumber,
		directional,
		streetTokens,
		locality,
		region,
		postcode,
		countryCode,
		segments: rawSegments,
		cleaned: cleaned || upper,
		confidence,
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/database && pnpm vitest run src/queries/parse-freeform-address.test.ts`
Expected: PASS (8 tests). If the AU `WA` (state) vs `WA` (US) overlap surfaces, note it is harmless here — both map to a valid region string used only for reranking.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/queries/parse-freeform-address.ts packages/database/src/queries/parse-freeform-address.test.ts
git commit -m "feat(db): add parseFreeformAddress component parser"
```

---

### Task 4: Anchor prefix builder (pure)

**Files:**
- Create: `packages/database/src/queries/structured-search.ts`
- Test: `packages/database/src/queries/structured-search.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/database/src/queries/structured-search.test.ts
import { describe, expect, it } from "vitest";
import { parseFreeformAddress } from "./parse-freeform-address.ts";
import { buildAnchorPrefixes } from "./structured-search.ts";

describe("buildAnchorPrefixes", () => {
	it("builds a single number+street anchor", () => {
		const parsed = parseFreeformAddress("1 Rocket Road, Hawthorne, CA 90250, US");
		expect(buildAnchorPrefixes(parsed)).toEqual(["1 ROCKET"]);
	});

	it("expands a leading directional into <=2 variants", () => {
		const parsed = parseFreeformAddress("1 N Rocket Rd, Hawthorne, CA 90250, US");
		expect(buildAnchorPrefixes(parsed)).toEqual(["1 N ROCKET", "1 NORTH ROCKET"]);
	});

	it("returns [] when there is no house number", () => {
		const parsed = parseFreeformAddress("Rocket Road, Hawthorne, CA, US");
		expect(buildAnchorPrefixes(parsed)).toEqual([]);
	});

	it("returns [] when there are no street tokens", () => {
		const parsed = parseFreeformAddress("90250, US");
		expect(buildAnchorPrefixes(parsed)).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/database && pnpm vitest run src/queries/structured-search.test.ts`
Expected: FAIL — `buildAnchorPrefixes` is not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/database/src/queries/structured-search.ts
import { directionalVariants } from "./address-abbreviations.ts";
import type { ParsedFreeformAddress } from "./parse-freeform-address.ts";

const MAX_ANCHOR_VARIANTS = 4;

/**
 * Build left-anchored `search_text` prefixes (without the trailing %) from a
 * parsed address. Reuses idx_addresses_search_text_btree, which orders rows as
 * "<number> <street_name> ...". Requires a house number (search_text leads with
 * it) and at least one street token; otherwise returns [] and the caller falls
 * back to fuzzy. A leading directional yields both abbreviated + expanded forms.
 */
export function buildAnchorPrefixes(parsed: ParsedFreeformAddress): string[] {
	if (!parsed.houseNumber || parsed.streetTokens.length === 0) {
		return [];
	}
	const firstStreet = parsed.streetTokens[0] as string;
	const heads = parsed.directional
		? directionalVariants(parsed.directional).map(
				(dir) => `${parsed.houseNumber} ${dir} ${firstStreet}`
			)
		: [`${parsed.houseNumber} ${firstStreet}`];
	return heads.slice(0, MAX_ANCHOR_VARIANTS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/database && pnpm vitest run src/queries/structured-search.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/queries/structured-search.ts packages/database/src/queries/structured-search.test.ts
git commit -m "feat(db): add structured-search anchor prefix builder"
```

---

### Task 5: Structured query executor

**Files:**
- Modify: `packages/database/src/queries/structured-search.ts`

This adds the DB-executing function. It is covered by the manual verification in Task 8
(it needs a live DB); the pure `buildAnchorPrefixes` already has unit coverage.

- [ ] **Step 1: Add the executor and its result mapper**

Append to `packages/database/src/queries/structured-search.ts`:

```ts
import { type SQL, sql } from "drizzle-orm";
import type { Database } from "../client.ts";
import type { AutocompleteResult } from "./autocomplete.ts";
import { mapStructuredRow, type RawStructuredRow, SELECT_COLUMNS } from "./autocomplete.ts";

/**
 * Structured match: OR'd anchored prefix scans (search_text btree), country as a
 * hard filter, postcode/locality/region as ORDER BY boosts. Returns [] when no
 * anchor qualifies so the caller can fall back to fuzzy. See design §4.4.
 */
export async function structuredAutocomplete(
	db: Database,
	parsed: ParsedFreeformAddress,
	opts: { limit: number; country?: string }
): Promise<AutocompleteResult[]> {
	const prefixes = buildAnchorPrefixes(parsed);
	if (prefixes.length === 0) {
		return [];
	}

	const likeClauses = prefixes.map(
		(p) => sql`search_text LIKE ${`${p}%`}`
	);
	const anchor = sql.join(likeClauses, sql` OR `);

	const filters: SQL<unknown>[] = [sql`(${anchor})`];
	const country = opts.country ?? parsed.countryCode ?? undefined;
	if (country) {
		filters.push(sql`country = ${country.toUpperCase()}`);
	}
	const whereClause = sql.join(filters, sql` AND `);

	const rerank: SQL<unknown>[] = [];
	if (parsed.postcode) {
		rerank.push(sql`(postcode = ${parsed.postcode}) DESC`);
	}
	if (parsed.locality) {
		rerank.push(sql`(locality = ${parsed.locality}) DESC`);
	}
	if (parsed.region) {
		rerank.push(sql`(state = ${parsed.region}) DESC`);
	}
	rerank.push(sql`population_score DESC`);
	const orderBy = sql.join(rerank, sql`, `);

	const result = await db.execute(sql`
		SELECT ${SELECT_COLUMNS}, 1.0 as similarity_score
		FROM addresses
		WHERE ${whereClause}
		ORDER BY ${orderBy}
		LIMIT ${opts.limit}
	`);

	return (result.rows as unknown as RawStructuredRow[]).map(mapStructuredRow);
}
```

- [ ] **Step 2: Export the row mapper + columns from `autocomplete.ts`**

In `packages/database/src/queries/autocomplete.ts`, change the existing private
declarations to named exports so `structured-search.ts` can reuse them (do NOT duplicate
the mapping logic — DRY):

- `const SELECT_COLUMNS = sql\`...\`` → `export const SELECT_COLUMNS = sql\`...\``
- `interface RawAddressRow { ... }` → `export interface RawStructuredRow { ... }` (rename) — update all in-file references from `RawAddressRow` to `RawStructuredRow`.
- `function mapRowToResult(row: RawAddressRow)` → `export function mapStructuredRow(row: RawStructuredRow)` — update all in-file references from `mapRowToResult` to `mapStructuredRow`.

- [ ] **Step 3: Type-check**

Run: `cd packages/database && pnpm vitest run src/queries/structured-search.test.ts`
Expected: PASS (4 tests still green; the executor compiles).

Run: `pnpm -w exec tsc -p packages/database/tsconfig.json --noEmit` (or the repo's type-check script).
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/database/src/queries/structured-search.ts packages/database/src/queries/autocomplete.ts
git commit -m "feat(db): add structured autocomplete executor reusing row mapper"
```

---

### Task 6: Wire the structured branch + cleaned fallback into `autocompleteAddresses`

**Files:**
- Modify: `packages/database/src/queries/autocomplete.ts`
- Modify: `packages/database/src/queries/index.ts`

- [ ] **Step 1: Import the new helpers at the top of `autocomplete.ts`**

```ts
import { parseFreeformAddress } from "./parse-freeform-address.ts";
import { structuredAutocomplete } from "./structured-search.ts";
```

- [ ] **Step 2: Add the structured branch at the start of `autocompleteAddresses`**

Inside `autocompleteAddresses`, immediately after `const trimmed = query.trim();` and the
empty guard, insert:

```ts
	// Freeform full-address path: parse into components and try the structured,
	// index-anchored query first. On a miss we fall through to the existing fuzzy
	// pipeline using the cleaned (comma/country-stripped) string. See design §4.4.
	const freeform = parseFreeformAddress(trimmed);
	const effectiveCountry = country ?? freeform.countryCode ?? undefined;
	if (freeform.confidence === "high") {
		const structured = await structuredAutocomplete(db, freeform, {
			limit,
			country: effectiveCountry,
		});
		if (structured.length > 0) {
			return { results: structured, parsedQuery: null };
		}
	}
	const searchBase = freeform.confidence === "high" ? freeform.cleaned : trimmed;
```

Then change the existing parse line from:

```ts
	const parsed = parseUnitAddress(trimmed);
	const searchInput = parsed ? parsed.streetQuery : trimmed;
```

to use the cleaned base and apply the detected country to every downstream filter:

```ts
	const parsed = parseUnitAddress(searchBase);
	const searchInput = parsed ? parsed.streetQuery : searchBase;
```

And change the filter construction from:

```ts
	const filterClauses = buildFilterClauses(country, state, parsed);
```

to:

```ts
	const filterClauses = buildFilterClauses(effectiveCountry, state, parsed);
```

- [ ] **Step 3: Export the public symbol from the barrel**

In `packages/database/src/queries/index.ts` add:

```ts
export type { ParsedFreeformAddress } from "./parse-freeform-address.ts";
export { parseFreeformAddress } from "./parse-freeform-address.ts";
```

- [ ] **Step 4: Run the full database test suite**

Run: `cd packages/database && pnpm test`
Expected: PASS — all existing tests plus the new ones. No regressions in
`parse-unit-address.test.ts` / `query-tokens.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/queries/autocomplete.ts packages/database/src/queries/index.ts
git commit -m "feat(db): route freeform addresses through structured search with fuzzy fallback"
```

---

### Task 7: Client-side input hint

**Files:**
- Modify: `packages/react-ui/src/utils/parse-address.ts`
- Test: `packages/react-ui/src/utils/parse-address.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/react-ui/src/utils/parse-address.test.ts
import { describe, expect, it } from "vitest";
import { cleanAddressInput } from "./parse-address.ts";

describe("cleanAddressInput", () => {
	it("collapses whitespace and trims", () => {
		expect(cleanAddressInput("  1   Rocket   Road  ")).toBe("1 Rocket Road");
	});

	it("normalizes spacing around commas", () => {
		expect(cleanAddressInput("1 Rocket Road ,Hawthorne,  CA 90250")).toBe(
			"1 Rocket Road, Hawthorne, CA 90250"
		);
	});

	it("returns empty string unchanged", () => {
		expect(cleanAddressInput("")).toBe("");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/react-ui && pnpm vitest run src/utils/parse-address.test.ts`
Expected: FAIL — `cleanAddressInput` is not exported.

- [ ] **Step 3: Add the helper to `parse-address.ts`**

```ts
/**
 * Light client-side cleanup before sending to the API for snappier typeahead.
 * The server is authoritative (parseFreeformAddress); this only normalizes
 * obvious whitespace/comma noise so keystrokes look clean. Does NOT strip the
 * country or parse components.
 */
export function cleanAddressInput(input: string): string {
	return input
		.replace(/\s*,\s*/g, ", ")
		.replace(/\s+/g, " ")
		.trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/react-ui && pnpm vitest run src/utils/parse-address.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/react-ui/src/utils/parse-address.ts packages/react-ui/src/utils/parse-address.test.ts
git commit -m "feat(react-ui): add cleanAddressInput typeahead hint"
```

---

### Task 8: Manual end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Start the web app**

Run: `pnpm dev` (from repo root; web on port 3001 per app CLAUDE.md). Open
`http://localhost:3001/components`.

- [ ] **Step 2: Verify the international cases that previously failed**

In the AddressAutocomplete / Live Demo input, type each and confirm results appear:
- `1 Rocket Road, Hawthorne, CA 90250, United States` → expect a Hawthorne, CA result.
- `10 Downing St, London, SW1A 2AA, UK` → expect a London result.
- `120 Main St, Sydney, NSW 2000, Australia` → expect an AU result (no regression).

Expected: each returns at least one address (no "No addresses found").

- [ ] **Step 3: Verify no typeahead regression**

Type `120 Mai` (partial). Expect the existing prefix/fuzzy suggestions still appear.

- [ ] **Step 4 (optional): Confirm the SQL path with a read-only query**

If deeper confirmation is wanted, with explicit approval run a read-only check against the
dev DB (reads only — never DDL/writes, per project policy):

```bash
psql "$DATABASE_URL" -c "SET statement_timeout='15s'; \
  SELECT country, state, locality FROM addresses \
  WHERE search_text LIKE '1 ROCKET%' AND country='US' LIMIT 3;"
```

Expected: at least one Hawthorne / CA row.

- [ ] **Step 5: Final commit (if any docs/notes updated)**

```bash
git add -A
git commit -m "test: verify freeform intl address matching end-to-end" --allow-empty
```

---

## Self-Review notes

- **Spec coverage:** §3 indexes → Task 4/5 anchor uses `idx_addresses_search_text_btree`; §4.1 parser → Task 3; §4.2 country → Task 1; §4.3 abbreviations → Task 2 (types rerank-only, directionals as variants in Task 4/5); §4.4 hybrid trigger/anchor/fallback → Task 6; §4.5 client hint → Task 7; §6 testing → Tasks 1–4, 7 unit + Task 8 manual; §7 no-DDL → confirmed (no migration tasks).
- **Type consistency:** `ParsedFreeformAddress` defined in Task 3 and consumed unchanged in Tasks 4–6; `buildAnchorPrefixes` / `structuredAutocomplete` signatures stable; `mapStructuredRow` / `RawStructuredRow` / `SELECT_COLUMNS` renamed in Task 5 and reused, not duplicated.
- **No live-DB unit tests:** the DB executor is intentionally verified manually (Task 8) per the repo's no-DOM / pure-logic test convention; all branching/parsing logic is unit-tested in isolation.
</content>
