# Freeform Address Input Normalizer + Hybrid Matching

- **Date:** 2026-06-18
- **Status:** Design (approved in brainstorming, pending written-spec review)
- **Area:** `packages/database` (query layer), `packages/react-ui` (client hint)

## 1. Problem

International address autocomplete returns "No addresses found" for fully-formatted
queries such as:

```
1 Rocket Road, Hawthorne, CA 90250, United States
```

even though the data is present (the intl manifest shows US + France + ~24 more
countries promoted to the dev/demo DB `ep-muddy-cake-a72eh7us`), and the code path
is country-agnostic (no hardcoded `AU`).

### Root cause

The raw freeform string is sent verbatim as `?q` and matched against `search_text`,
which `scripts/intl/ingest.ts` (`PROMOTE_SQL`) builds as:

```sql
trim(concat_ws(' ',
  number_first, number_last, street_name, street_type, street_suffix,
  building_name, locality, state, postcode, country))
```

i.e. **UPPERCASE, space-delimited, no commas, country as 2-letter ISO** (`US`, not
"United States"). So `1 Rocket Road, Hawthorne, CA 90250, United States` fails three ways:

1. **Commas** — the fast path is `search_text LIKE 'INPUT%'`; the first comma breaks
   the left-anchored prefix immediately.
2. **"United States" vs `US`** — the trailing country name exists nowhere in stored text.
3. **Fuzzy dilution** — tier-2/3 trigram similarity of the comma'd, country-suffixed
   string falls below the 0.3 threshold, so even fuzzy returns nothing.

AU partial typeahead "works" only because users type left-anchored prefixes
(`120 Main St…`) that the prefix path is designed for.

## 2. Goals / Non-goals

**Goals**
- Fully-formatted Western addresses (street, city, region, postcode, country) match
  reliably across the loaded countries (US + EU + AU).
- Keep DB operations lean on the 173M-row table: reuse existing indexes, no new index,
  bounded number of index range scans per query.
- No regressions to existing partial-typeahead behavior.

**Non-goals (v1)**
- Reversed / Eastern address orderings (postcode-first, etc.).
- PO boxes, intersections ("5th & Main").
- Fuzzy/ML country detection. Country detection is an exact-ish lookup only.
- Geographic disambiguation beyond ranking (we return best candidates; we don't resolve).

## 3. Index facts (constraints the design relies on)

From `packages/database/drizzle/*.sql`:

- `idx_addresses_search_text_btree` — `btree(search_text text_pattern_ops)` → supports
  left-anchored `search_text LIKE 'UPPER%'`. **This is the structured anchor.**
- `idx_addresses_country` — `btree(country)`.
- `idx_addresses_country_state_postcode`, `idx_addresses_postcode` — for filter/rerank.
- `idx_addresses_search_text_trgm` — GIN trigram, used by the existing fuzzy path.
- There is **no** `text_pattern_ops`/trigram index on `street_name` alone
  (`idx_addresses_street` leads with `locality`), so the anchor must go through
  `search_text`, which always begins with `number_first … street_name …`.

Adapter facts that shape normalization:
- **Overture** (US, France, most EU): `street_type = NULL`; the type is embedded in
  `street_name` with the source's own spelling (`scripts/intl/adapters/overture.ts:60`).
- **ODA** (Canada) and **GNAF** (AU): `street_type` is a separate, usually spelled-out field.
- Therefore stored street-type spelling is **not** canonicalized. The anchor stops before
  the type, so type spelling never affects the anchor — only directionals (which sit
  between the house number and the street name) do.

## 4. Components

### 4.1 `parseFreeformAddress(input): ParsedFreeformAddress`
New pure, env-free function in `packages/database/src/queries/parse-freeform-address.ts`.

```ts
interface ParsedFreeformAddress {
  houseNumber: string | null;      // leading number(s), e.g. "1" or "1-3"
  directional: string | null;      // leading directional token if present (raw, e.g. "N")
  streetTokens: string[];          // remaining street words, UPPERCASE (incl. type token)
  locality: string | null;         // UPPERCASE
  region: string | null;           // 2-letter state/region code if recognized
  postcode: string | null;         // UPPERCASE, source format preserved
  countryCode: string | null;      // ISO-2, mapped from name/code
  segments: string[];              // comma segments after cleanup (for trigger logic)
  cleaned: string;                 // punctuation-stripped, country-stripped, collapsed
  confidence: "high" | "low";      // high when countryCode || postcode || segments>=2
}
```

Rules (punctuation/case/space + abbreviation handling):
1. Uppercase, collapse internal whitespace, split on commas into `segments`.
2. **Country**: match last segment (or trailing token) against the country map (§4.2).
   On hit, set `countryCode` and remove the token from `cleaned`/segments.
3. **Postcode**: detect within segments by pattern — US `\d{5}(-\d{4})?`, AU `\d{4}`,
   UK `[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}`, CA `[A-Z]\d[A-Z] \d[A-Z]\d`. First match wins.
4. **Region/state**: recognized 2-letter code (US/AU sets) → `region` (rerank only).
5. **Street**: first segment → split leading house number → `houseNumber`; if the next
   token is a directional (§4.3) → `directional`; the rest → `streetTokens`.
6. **Locality**: the middle segment(s) between street and region/postcode.
7. `confidence = high` iff `countryCode || postcode || segments.length >= 2`.

### 4.2 Country lookup
Static map scoped to loaded countries, name + common variants → ISO-2:
`United States|USA|U.S.|US → US`, `France → FR`, `Australia → AU`,
`United Kingdom|UK|Great Britain → GB`, plus the other loaded EU countries. Exact,
case-insensitive token/segment match. No fuzzy matching.

### 4.3 Abbreviation maps
- **Directionals** (bidirectional canonical set): `N↔NORTH, S↔SOUTH, E↔EAST, W↔WEST,
  NE↔NORTHEAST, NW↔NORTHWEST, SE↔SOUTHEAST, SW↔SOUTHWEST`.
  Used to generate anchor variants (§4.4). This is the only abbreviation class that
  touches the indexed anchor.
- **Street types** (canonical map): `RD↔ROAD, ST↔STREET, AVE↔AVENUE, BLVD↔BOULEVARD,
  DR↔DRIVE, LN↔LANE, CT↔COURT, PL↔PLACE, HWY↔HIGHWAY, …` and **unit types**
  (`APT↔APARTMENT, UNIT, STE↔SUITE`). Used **only** for reranking and the fuzzy-fallback
  string — never in the anchor, so zero added index cost.
  - "St" ambiguity (Saint vs Street): only treat `ST` as Street when it is the trailing
    street token; never expand to Saint.

### 4.4 Hybrid matching in `autocompleteAddresses`
A structured branch is added in front of the existing logic.

**Trigger:** use the structured path when `confidence === "high"`
(`countryCode || postcode || segments >= 2`) **and** `houseNumber` is present (the
`search_text` anchor leads with the number). Otherwise fall through to today's fuzzy path
on the `cleaned` string (with the country filter applied if detected).

**Anchor:** build 1–4 anchor prefixes from `houseNumber + [directional variants] + first
street name token`, e.g. for `1 N Rocket Rd`:

```sql
WHERE (search_text LIKE '1 N ROCKET%' OR search_text LIKE '1 NORTH ROCKET%')
  AND country = 'US'                          -- when detected
ORDER BY (postcode = '90250') DESC,           -- rerank boosts
         (locality = 'HAWTHORNE') DESC,
         (state = 'CA') DESC,
         population_score DESC
LIMIT :limit
```

- Anchor LIKEs use `idx_addresses_search_text_btree` (bitmap-OR of ≤4 range scans).
- `country` is a hard filter (recheck on the already-narrow candidate set).
- `postcode`/`locality`/`region` are **ranking** signals, not filters → maximizes hit-rate.
- Variant count is capped at 4 (one directional → 2 variants; no directional → 1).

**Fallback:** if the structured query returns 0 rows, run the existing fuzzy path on
`cleaned` (retaining the `country` filter). Guarantees no regression and a graceful
degrade for imperfect parses.

### 4.5 Client hint (`packages/react-ui/src/utils/parse-address.ts`)
Light, synchronous cleanup before the request for snappy typeahead: strip commas,
collapse whitespace. The server remains authoritative (defense in depth); the client does
**not** need the full parser.

## 5. Data flow examples

| Input | Path | Resulting match |
|---|---|---|
| `1 Rocket Road, Hawthorne, CA 90250, United States` | structured | `LIKE '1 ROCKET%' AND country='US'`, ranked by zip/locality/state → 1 row |
| `1 N Rocket Rd, Hawthorne, CA, US` | structured | `('1 N ROCKET%' OR '1 NORTH ROCKET%') AND country='US'` |
| `10 Downing St, London, SW1A 2AA, UK` | structured | `LIKE '10 DOWNING%' AND country='GB'`, zip/locality rerank |
| `120 Main St, Sydney, NSW 2000, Australia` | structured | `LIKE '120 MAIN%' AND country='AU'` |
| `120 Mai` | fuzzy | existing prefix/trigram path (unchanged) |
| `Eiffel Tower` | fuzzy | existing path |
| `Rocket Road, Hawthorne, CA` (no house number) | fuzzy | cleaned string + country filter |

## 6. Testing

Pure-function table tests (repo no-DOM convention: pure logic + mock-fetch at the SDK
boundary):
- `parseFreeformAddress`: the seven §5 rows + variants (missing country, missing postcode,
  range number `1-3`, directional present/absent, "St" trailing vs leading).
- Anchor builder: directional variant generation, ≤4 cap, uppercase, country filter on/off.
- Query-shape assertions mirroring the existing `geocode-query` tests (no live DB).
- Regression: confirm bare typeahead (`120 Mai`) still takes the fuzzy path unchanged.

## 7. Rollout / risk

- Server change is additive (new branch + fallback) — low regression risk; fuzzy fallback
  catches any parse miss.
- No schema/index change; no migration; no DDL → no DB-approval gate.
- Cost: structured queries do ≤4 indexed range scans + a bounded rerank, cheaper than the
  current trigram scan on no-match intl queries.
- Main residual risk: locality/segment misattribution for unusual formats → degrades to
  fuzzy, never to an error.

## 8. Open follow-ups (future, not v1)
- Reversed/Eastern formats; PO boxes; intersections.
- Promote the client cleanup into a shared SDK helper if non-react consumers need it.
- Optional `street_name text_pattern_ops` index if number-less structured matching is
  later desired.
</content>
