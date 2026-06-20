# UK (GB) Address Data — Free-Source Ingestion Plan

**Status:** Proposal · **Date:** 2026-06-21 · **Author:** Joseph Amani (+ Claude)

## TL;DR

The UK cannot be loaded the way the other 28 countries were. **Overture's address
theme contains 0 GB rows** (verified 2026-06-21 against release `2026-05-20.0`:
`SELECT count(*) … WHERE country='GB'` → 0). The authoritative full-text UK address
files (Royal Mail **PAF**, OS **AddressBase**) are commercial. To get UK data for
free we must build a **dedicated GB pipeline that merges several open datasets**,
each covering a different layer of the address pyramid.

No single free source gives house-number-level address *text* nationwide. We get
there by layering:

1. **OSM** — the only free source of premise-level address *text* (house number +
   street + postcode + coords). Incomplete coverage, but real individual addresses.
2. **OS Open Names + Code-Point Open** — nationwide street and postcode geocoding to
   guarantee 100% postcode/street coverage where OSM has no premises.
3. **OS Open UPRN** (optional) — ~40M property-point coordinates to enrich premise
   coverage via spatial join. Heavy; deferred.

## How this fits the existing pipeline

The intl pipeline (`scripts/intl/`) is adapter-based:
`ingest.ts` (orchestrator) → adapter (`overture` | `oda`) emits a canonical staging
CSV → staged into `addresses_staging` → promoted into `addresses` with `search_text`
+ `geom` built in SQL. A country is registered in
`scripts/intl/lib/source-registry.ts` and loaded from exactly one adapter.

This plan adds **two new adapters** (`osm`, `os-open`) and registers `GB`. The
staging CSV contract, dedup-at-extract pattern, pre/post-flight safety checks, and
`--db`/`--replace`/`--dry-run` semantics are reused unchanged.

Staging CSV columns (unchanged contract):
`source,country,state,locality,postcode,street_name,street_type,street_suffix,
building_name,flat_type,flat_number,level_type,level_number,number_first,
number_last,longitude,latitude,confidence`

GB field mapping decisions:
- `country='GB'`, `state="none"` (→ promotes to NULL) — mirrors the European
  single-level countries. (Optionally map the 4 home nations to `state` later;
  not required for v1.)
- `locality` = post town / city (OSM `addr:city`/`addr:town`/`addr:suburb`;
  OS Open Names populated place).
- `postcode` = `addr:postcode` / OS postcode unit.
- `street_name` = `addr:street` / OS Open Names road name.
- `number_first` = `addr:housenumber`; `building_name` = `addr:housename`.
- Coords: WGS84 (EPSG:4326). **OS data is British National Grid (EPSG:27700)** and
  must be reprojected (`ST_Transform(geom, 27700, 4326)` in DuckDB spatial, or use
  the lat/lon columns OS Open UPRN ships natively).

## Free sources (verified 2026-06-21)

| Source | Gives us | Coverage | Format | Licence |
|---|---|---|---|---|
| **OSM** (Geofabrik `united-kingdom-latest.osm.pbf`, 2.1 GB) | house no. + street + postcode + city + coords | Partial (strong in cities, sparse rural) | PBF | **ODbL** (attribution + share-alike) |
| **OS Open UPRN** (~40M points) | UPRN + coords (no text) | Complete (every addressable location) | CSV / GeoPackage | **OGL** (attribution) |
| **OS Open Names** | streets, settlements, postcodes (no house no.) | Complete street/place | CSV / GeoPackage (GML) | **OGL** |
| **Code-Point Open** (~1.7M postcodes) | postcode-unit centroids | Complete postcodes | CSV | **OGL** |
| **ONS Postcode Directory (ONSPD)** | postcode → lat/lon + admin geog | Complete postcodes | CSV | **OGL** |

Geofabrik UK note: includes Great Britain **and Northern Ireland**, but **not** the
Isle of Man or Channel Islands (use the `britain-and-ireland` extract if those are
needed). OS OpenData (UPRN / Open Names / Code-Point) is **GB only** (no NI) — NI
premise coords would come from OSM + OSNI open data separately if required.

### ⚠️ Licensing decision needed before we ship

OSM is **ODbL** (share-alike). Serving OSM-derived addresses through the API is
fine with attribution, but ODbL's share-alike can attach to a "derived database."
Our other data (G-NAF, Overture) is permissive/OGL. **Action: product/legal sign-off
on mixing ODbL into the served corpus**, plus an attribution line for OSM + "Contains
OS data © Crown copyright and database right 2026" for the OGL sources. If ODbL is
unacceptable, v1 ships OGL-only (Tiers 2–3): postcode + street geocoding, no house
numbers.

## Phased plan

### Phase 0 — Decide & size (no DB writes)
- [x] Confirm Overture GB = 0 (done).
- [ ] Size OSM: download UK PBF, count objects with `addr:housenumber` (via
  `osmium tags-filter` / GDAL OSM driver). Establishes Tier-1 row count.
- [ ] Licensing sign-off (ODbL mix vs OGL-only). **Gating decision.**

### Phase 1 — `osm` adapter → individual GB addresses (headline value)
- New `scripts/intl/adapters/osm.ts`. Toolchain: `osmium tags-filter` to pull
  objects carrying `addr:housenumber`, then GDAL/DuckDB spatial to read the OSM
  `points` + `multipolygons` layers, centroid the polygons (`ST_Centroid`), and
  shape into the staging CSV with the same dedup window-function pattern as
  `overture.ts`.
- Register `GB: { adapter: "osm", state: "none", notes: … }`.
- Run `bun scripts/intl/ingest.ts GB --db @<file> --dry-run`, eyeball sample, then
  load. Re-runs use `--replace`.

### Phase 2 — `os-open` adapter → nationwide street + postcode coverage
- New `scripts/intl/adapters/os-open.ts`. Loads **Code-Point Open** as
  postcode-level rows (no street/number) and **OS Open Names** roads as
  street-level rows (no number), reprojecting 27700→4326. Guarantees 100% postcode
  and street geocoding even where OSM has no premises.
- These coexist with Tier-1 rows in `addresses` (same `country='GB'`), distinguished
  by `source` (`OSM` vs `OS_CODEPOINT` / `OS_OPENNAMES`) and by empty
  `number_first`. Confirm the rerank/autocomplete read paths handle number-less rows
  (they already do for street-level European rows).

### Phase 3 — OS Open UPRN spatial enrichment (optional, heavy)
- Spatially join the ~40M UPRN points to nearest OS Open Names street + Code-Point
  postcode to synthesise premise-point rows where OSM lacks them. Near-complete
  point coverage, but large; assess Neon cost first (campaign already at 8–16 CU /
  153 GB). Defer until Phases 1–2 are validated in prod.

## Risks / open questions
- **Coverage honesty:** Tier-1 (OSM) alone is partial. Set expectations: "best-effort
  free UK addresses + complete postcode/street geocoding," not PAF parity.
- **Dedup across tiers:** an OSM premise and a UPRN-derived point for the same
  property could double-count — Phase 3 needs a proximity+street dedup rule.
- **Neon cost / sizing** — confirm after Phase 0 sizing.
- **NI / Crown Dependencies** — OGL sources are GB-only; decide if NI/IoM/CI matter.
- **Update cadence:** OSM weekly, OS OpenData every 6 weeks — wire into the queue
  later; v1 is a one-shot load.

## Recommendation
Start with **Phase 0 sizing + the licensing decision**, then ship **Phase 1 (OSM)**
for real individual addresses and **Phase 2 (Code-Point + Open Names)** for complete
postcode/street geocoding. That delivers usable UK data entirely from free sources.
Phase 3 (UPRN) is a later coverage upgrade, not needed for launch.
