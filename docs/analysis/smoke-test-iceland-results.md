# Iceland Smoke Test — Results (2026-06-12)

**Pipeline spec:** `address-ingestion-pipeline-spec.md` §9 (Overture adapter)
**Target:** Neon branch `smoke-iceland` (`br-sweet-forest-a77khf5x`, project `raspy-salad-37313917`) — production untouched.

## Outcome: PASS

| Stage | Result |
|---|---|
| Overture pull (DuckDB → S3, release `2026-05-20.0`) | 138,586 rows extracted — exact match to Overture's published IS count |
| Stage load (`psql \copy` → unlogged staging) | 138,586 copied |
| Dedup | −64 → **138,522 staged** |
| Promote (`INSERT…SELECT` + search_text + `ST_MakePoint`) | 138,522 inserted, **0 null geoms** |
| AU isolation | AU = 16,841,097 before and after (branch); prod never written |
| Proximity query (`ST_DWithin` geography, central Reykjavík) | Uses `idx_addresses_geom_geography` (Bitmap Index Scan); returns Bankastræti/Laugavegur at 8–24 m ✅ |
| AU-style prefix autocomplete (`'26 Laugavegur%'`) | ✅ matches |
| Staging cleanup | dropped |

## Iceland data shape (Overture)
- Single `address_levels` entry = municipality → mapped to `locality`; `state=''`.
- Rural addresses are place-names with **no street number** (e.g. `Flaggstangarhóll`) — legitimate, kept when street present.
- `unit` sometimes holds building descriptors (`Íbúðarhús`) — flows to `flat_number` when ≤10 chars; candidate for libpostal/token cleanup later.

## Findings to fix before full rollout

1. **`search_text` double space when `state=''`** — `concat_ws` skips NULLs but not empty strings: `"1 Reykjanesvitabraut Reykjanesbær  233 IS"`. Fix in promote SQL: `NULLIF(state,'')` (and same for other optional parts).
2. **Local-format autocomplete gap** — Icelandic users type `"Laugavegur 26"` (street-first), but `search_text` is number-first (`"26 Laugavegur …"`), so the prefix path misses; only the `street_name ILIKE` fallback catches it (203 Laugavegur rows present). Decide: per-country search_text ordering, or rely on/strengthen the parsed-path fallback in `autocomplete.ts`.
3. **`unit` semantics vary by country** — needs the per-country token map before promoting unit → flat_number blindly.
4. libpostal + GeoNames stages not exercised in this run (installed; deferred) — validate on the next country.

## Tooling notes
- `brew install duckdb` broke Homebrew node (simdjson dylib bump) → fixed with `brew reinstall node`; neonctl needed re-auth + `--org-id`.
- DuckDB needs explicit `INSTALL spatial; INSTALL httpfs;` once per machine.
- Latest Overture release resolvable via STAC: `SELECT latest FROM 'https://stac.overturemaps.org/catalog.json'`.

## Formalized pipeline (2026-06-12, post-smoke)

The ad-hoc smoke commands are now `scripts/intl/`:
- `ingest.ts` — orchestrator: registry gate → extract → `\copy` staging → dedup → transactional promote → post-flight invariant check (fails loudly if any *other* country's row count changed) → manifest append. Requires explicit `--db <url|@file>` (never reads `.env`); refuses re-ingest without `--replace`.
- `adapters/overture.ts` — DuckDB S3 pull with `squash()` whitespace normalization (fixed 3 source-data double-space rows).
- `lib/source-registry.ts` — per-country tier config; unregistered countries are refused with a pointer to the spec §9.6 checklist.
- `manifest.json` — per-run audit trail.

Re-validated end-to-end via `bun scripts/intl/ingest.ts IS --db @… --replace`: 138,522 promoted, 0 null geoms, **0 double-space search_text rows** (finding #1 fixed via `NULLIF` + squash), AU invariant held. Biome/Ultracite clean.

**Still open:** finding #2 (street-first autocomplete format for IS-style input — decision needed in `autocomplete.ts`), finding #3 (per-country unit token map), libpostal + GeoNames stages (spec §9.3/9.4) not yet implemented.

## Branch status
`smoke-iceland` retained for inspection (AU 16.84M + IS 138,522 rows). Delete with:
`neonctl branches delete smoke-iceland --project-id raspy-salad-37313917`
