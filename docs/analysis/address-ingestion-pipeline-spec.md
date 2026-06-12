# US + Canada Address Ingestion Pipeline — Full Spec

**Date:** 2026-06-11
**Companion to:** `international-address-data-ingestion-assessment.md`
**Goal:** Load US + Canada addresses into the existing `addresses` table at parity with the AU/G-NAF rows, by combining authoritative sources + derivation + clean tabular enrichment. **No schema migration required.**

---

## 0. Source-of-truth per column

| `addresses` column | US source | CA source | Mechanism |
|---|---|---|---|
| country | const `US` | const `CA` | literal |
| state | NAD `State` | ODA PRUID → 2-letter | map |
| locality | NAD `Post_City`/`Inc_Muni` | ODA `City` | direct |
| postcode | NAD `Zip_Code` (+ZCTA backfill) | ODA `Postal Code` | direct + backfill |
| streetName | NAD `St_Name` | ODA `Street Name` | direct |
| streetType | NAD `St_PosTyp` | ODA `Street Type` | direct |
| streetSuffix | NAD `St_PosDir` | ODA `Street Direction` | direct |
| buildingName | NAD `Building` | — (null) | direct |
| flatType / flatNumber | parse NAD `Unit` | parse ODA `Unit` | **derive** |
| levelType / levelNumber | parse NAD `Floor`/`Room` | — | **derive** |
| numberFirst | NAD `Add_Number`/`AddNo_Full` | ODA `Civic Number` | direct |
| numberLast | — (rare) | — | null |
| longitude / latitude | NAD `Longitude`/`Latitude` | ODA `Longitude`/`Latitude` | direct |
| geom | — | — | `ST_SetSRID(ST_MakePoint(lon,lat),4326)` |
| confidence | derive from NAD `Placement`/`AddrClass` | const/null | **derive** |
| gnafPid | — | — | null (AU-only key) |
| searchText | — | — | generated (match `autocomplete.ts`) |
| populationScore | Census place pop (join) | StatCan CSD pop (join) | **clean join** |
| adminLevel | const 5 (address-level) | const 5 | literal |

---

## 1. Datasets to download

| # | Dataset | Role | Format | License | Key for joins |
|---|---|---|---|---|---|
| A | **US NAD** (`transportation.gov/gis/national-address-database`) | US core addresses | Esri FileGDB per-state (+ national) | Public domain | `Census_Plc` / state+place FIPS |
| B | **StatCan ODA** (`statcan.gc.ca/en/lode/databases/oda`) | CA core addresses | CSV per province | OGL-Canada | `CSDUID` |
| C | **Census place population** — Census API `api.census.gov/data/2020/dec/pl?get=NAME,P1_001N&for=place:*&in=state:*` | US `populationScore` | JSON/CSV | Public domain | state+place FIPS |
| D | **StatCan 2021 Census — population by CSD** (Census Profile, CSDUID-keyed CSV) | CA `populationScore` | CSV | OGL-Canada | `CSDUID` |
| E | *(optional)* **Census ZCTA polygons** (TIGER ZCTA520) | US `postcode` backfill | Shapefile | Public domain | point-in-polygon |

Datasets A + B are mandatory; C + D close `populationScore`; E is optional.

---

## 2. Tooling / prereqs

- **GDAL `ogr2ogr`** — to read NAD FileGDB → CSV (`brew install gdal`). The FeatureServer REST API is a fallback but slow at 67M rows.
- **`psql`** (already required by `import-gnaf.ts`) — for `\copy` bulk load.
- **Bun/Node** — per-source transform adapters.
- **PostGIS** enabled on Neon (already in use for `geom`).
- Disk: enough for intermediate CSVs *or* stream CSV straight to `psql \copy FROM STDIN`. Do **not** keep both raw GDB and CSV expanded for all states at once.

---

## 3. Canonical staging schema

Load everything into an **unlogged** staging table first (fast COPY, no WAL), enrich in place, then promote.

```sql
CREATE UNLOGGED TABLE addresses_staging (
  source        text not null,          -- 'NAD' | 'ODA'
  country       varchar(2) not null,
  state         varchar(10) not null,
  locality      text not null default '',
  postcode      varchar(10) not null default '',
  street_name   text not null default '',
  street_type   varchar(20),
  street_suffix varchar(10),
  building_name text,
  flat_type     varchar(10),
  flat_number   varchar(10),
  level_type    varchar(10),
  level_number  varchar(10),
  number_first  varchar(15),
  number_last   varchar(15),
  longitude     real not null,
  latitude      real not null,
  confidence    integer,
  -- join keys carried through enrichment, dropped on promote:
  place_fips    varchar(7),   -- US: state+place
  csduid        varchar(7),   -- CA
  population_score integer not null default 0,
  admin_level   integer not null default 5,
  dedup_hash    text          -- for cross-provider dedup
);
```

---

## 4. Stages

### Stage 1 — Acquire
Script `scripts/intl/01-download.sh`: pull per-state NAD GDB zips, per-province ODA CSVs, Census place-pop (C) and StatCan CSD-pop (D) tables. Record a manifest of completed files for resumability.

### Stage 2 — Source adapters → canonical CSV
Two modules emitting the staging column order:
- `scripts/intl/adapters/nad.ts` — `ogr2ogr -f CSV` each state GDB layer, stream rows, map NAD fields → canonical, set `source='NAD'`, `country='US'`.
- `scripts/intl/adapters/oda.ts` — stream ODA province CSV, map fields, `source='ODA'`, `country='CA'`, PRUID→state.

### Stage 3 — Normalize & derive (in adapter)
- **Unit parsing:** `"APT 3B"` → `flat_type='APT'`, `flat_number='3B'`; `"FL 2"`/`Floor`/`Room` → `level_type`,`level_number`. Keep a small token map (APT, UNIT, STE, FL, RM, BLDG…).
- **Coordinate validation:** drop null / `(0,0)` / out-of-bounds; round to 6 dp.
- **State/Province:** NAD `State` already 2-letter; ODA PRUID (10=NL … 62=NU) → 2-letter.
- **Skip rule:** drop rows with no `number_first` AND no `street_name`.
- **dedup_hash:** `md5(country|state|lower(locality)|lower(street_name)|number_first|round(lat,5)|round(lon,5))` — NAD aggregates many providers; dedup within/around borders.
- Carry `place_fips` (US) / `csduid` (CA) for Stage 5.

### Stage 4 — Stage load
`psql \copy addresses_staging (...) FROM '<csv|STDIN>' WITH (FORMAT csv)` — per state/province so a failure is resumable. Then dedup:
```sql
DELETE FROM addresses_staging a USING addresses_staging b
WHERE a.ctid < b.ctid AND a.dedup_hash = b.dedup_hash;
```

### Stage 5 — Enrich (set-based SQL, joins on codes — not on addresses)
1. **populationScore (US):** load Census place-pop into temp table keyed by state+place FIPS; `UPDATE addresses_staging SET population_score = p.pop FROM census_place_pop p WHERE place_fips = p.fips`.
   - *If NAD `Census_Plc` is a name, not FIPS:* fall back to join on `(state, normalized place name)` — still place-level, not address-level (confirm from a sample state, see §6).
2. **populationScore (CA):** `UPDATE ... FROM statcan_csd_pop s WHERE csduid = s.csduid`.
3. **postcode backfill (optional, US):** for rows with empty postcode, point-in-polygon against ZCTA (`ST_Contains`), set `postcode`.
4. **confidence (US):** map NAD `Placement`/`AddrClass` → integer (e.g. rooftop/parcel→90, interpolated→60); leave ODA null.

### Stage 6 — Promote into `addresses`
```sql
INSERT INTO addresses
 (country,state,locality,postcode,street_name,street_type,street_suffix,
  building_name,flat_type,flat_number,level_type,level_number,
  number_first,number_last,longitude,latitude,confidence,gnaf_pid,
  search_text,geom,population_score,admin_level)
SELECT country,state,locality,postcode,street_name,street_type,street_suffix,
  building_name,flat_type,flat_number,level_type,level_number,
  number_first,number_last,longitude,latitude,confidence,NULL,
  <searchText expr>, ST_SetSRID(ST_MakePoint(longitude,latitude),4326),
  population_score,admin_level
FROM addresses_staging;
```
Build `search_text` with the **same normalization** the API uses (read `packages/database/src/queries/autocomplete.ts` and mirror it exactly — parity matters for ranking).

### Stage 7 — Indexes & analyze
The two GiST geom indexes (`idx_addresses_geom`, `idx_addresses_geom_geography`) and the btrees already exist. For a load this size, **drop the GiST indexes before bulk insert and recreate after**, then `VACUUM ANALYZE addresses`. Drop the unlogged staging table.

### Stage 8 — (Optional) locality rows for autocomplete parity
If AU inserts locality-level rows for autocomplete ranking, insert one row per Census place / CSD (centroid geom, `admin_level` = locality level, `population_score` from C/D). This *reuses* datasets C/D — no new source.

### Stage 9 — Validate
Row counts per country/state; spot-check `/geocode`, `/reverse`, `/nearby`, autocomplete for a known US + CA address; compare latency/ranking to AU. Confirm `populationScore` join hit-rate (% rows enriched).

---

## 5. Run order (resumable, smallest-first)
`CA (ODA)` → `US Northeast states (NAD)` → `Midwest` → `South` → `West`. One file = one COPY unit; manifest tracks done. Enrich (Stage 5) after each country's staging is fully loaded.

---

## 6. Open items to confirm against a sample
1. **NAD `Census_Plc` content** — FIPS code vs place name (decides the Stage-5.1 join strategy). Pull one state GDB and inspect.
2. **`autocomplete.ts` search_text + populationScore formula** — mirror exactly for parity.
3. **`adminLevel` semantics in AU rows** — confirm 5 = address-level before reusing.
4. **Neon storage/cost headroom** for ~70–80M new rows + indexes (the dominant risk from the assessment).

---

## 7. Module layout
```
scripts/intl/
  01-download.sh
  02-stage.ts            # orchestrates adapters → \copy, resumable via manifest
  03-enrich.sql          # Stage 5 joins
  04-promote.sql         # Stage 6 + index rebuild
  adapters/
    nad.ts               # FileGDB → canonical CSV
    oda.ts               # CSV → canonical CSV
    parse-unit.ts        # shared Unit/Floor → flat/level derivation
  lib/
    state-codes.ts       # PRUID → province, FIPS → state
    dedup.ts
```

## 9. Global extension — Overture adapter & tier precedence

Extends the same pipeline to any country, per assessment §8. All adapters emit the §3 canonical staging row; nothing downstream changes.

### 9.1 Tier registry

One config file drives which source wins per country:

```ts
// scripts/intl/lib/source-registry.ts
export type SourceTier = "national" | "overture";
export const SOURCE_REGISTRY: Record<string, { tier: SourceTier; adapter: string }> = {
  AU: { tier: "national", adapter: "gnaf" },      // existing import-gnaf.ts
  US: { tier: "national", adapter: "nad" },
  CA: { tier: "national", adapter: "oda" },
  FR: { tier: "national", adapter: "ban" },        // future
  NL: { tier: "national", adapter: "bag" },        // future
  // everything else falls back to overture:
  DEFAULT: { tier: "overture", adapter: "overture" },
};
```

Precedence rule: **a country is loaded from exactly one tier** (national if registered, else Overture). Never both — same dedup principle as the OpenAddresses tier rule in assessment §4.2. Switching a country from Tier 2 → Tier 1 later = `DELETE FROM addresses WHERE country = $1` + reload (id is identity, nothing references address ids across countries).

### 9.2 Overture adapter — `scripts/intl/adapters/overture.ts`

**Prereq:** `duckdb` CLI (`brew install duckdb`). Pin a release version (e.g. `2026-05-xx.0`) in config — releases are monthly; never mix releases across countries without recording which release each country came from.

Per-country pull straight from S3 → canonical CSV (no bulk download):

```sql
-- duckdb -c "..." (httpfs + spatial autoloaded)
INSTALL spatial; LOAD spatial;
SET s3_region='us-west-2';
COPY (
  SELECT
    'OVERTURE'                                   AS source,
    country                                      AS country,
    -- address_levels is ordered general→specific:
    COALESCE(address_levels[1].value, '')        AS state_raw,
    COALESCE(address_levels[len(address_levels)].value, '') AS locality,
    COALESCE(postcode, '')                       AS postcode,
    COALESCE(street, '')                         AS street_name,
    NULL AS street_type, NULL AS street_suffix,  -- filled by libpostal stage
    NULL AS building_name,
    NULL AS flat_type,
    unit                                         AS flat_number,
    NULL AS level_type, NULL AS level_number,
    number                                       AS number_first,
    NULL AS number_last,
    ST_X(geometry)                               AS longitude,
    ST_Y(geometry)                               AS latitude,
    NULL AS confidence,
    id                                           AS source_id   -- GERS id, kept in staging
  FROM read_parquet(
    's3://overturemaps-us-west-2/release/<RELEASE>/theme=addresses/type=address/*',
    filename=true, hive_partitioning=1)
  WHERE country = '<CC>'
    AND geometry IS NOT NULL
    AND (number IS NOT NULL OR street IS NOT NULL)   -- §Stage-3 skip rule
) TO '<out>/overture-<cc>.csv' (FORMAT csv, HEADER false);
```

The TS adapter wraps this: substitutes `<RELEASE>`/`<CC>`, shells out to duckdb, then post-processes the CSV through the shared normalizers (state mapping, dedup_hash, coordinate validation — same code path as nad.ts/oda.ts).

**Staging additions:** `ALTER TABLE addresses_staging ADD COLUMN source_id text;` — carries the GERS id; optionally promote later into a future `source_id` column on `addresses` for stable upstream references (the only schema change worth considering; not required).

**Per-country state mapping** (`address_levels[1]` → `state varchar(10)`): map full region names → ISO 3166-2 suffix codes (`"Bayern"` → `BY`, `"Île-de-France"` → `IDF`). Ship `lib/state-codes.ts` tables per enabled country; countries with 1-level addressing (e.g. small states) get `state = ''`. **Gate each country on having this mapping before enabling it** — don't load free-text region names into a varchar(10).

### 9.3 libpostal derivation stage (Tier 3a) — `scripts/intl/05-libpostal.ts`

Runs after Stage 4 (stage load), before Stage 5, **only on rows where `street_type IS NULL AND source = 'OVERTURE'`**:

- `parse_address(street)` → extract trailing thoroughfare type (`"Hauptstraße"` → type `straße`; `"Rue de la Paix"` → leading-type languages handled by libpostal's per-language models) → `street_type` (normalized token, ≤20 chars), remainder → `street_name`.
- `parse_address(unit)` → `flat_type` / `flat_number` (reuses `parse-unit.ts` token map first; libpostal as fallback).
- Mark derived rows: `confidence = 50` (inferred), vs 60–90 for source-provided (NAD mapping in Stage 5.4). This encodes "parsed, not authoritative" without a schema change.
- Node binding: `node-postal` (requires libpostal C lib: `brew install libpostal`, ~2GB model download). Batch in-process; ~10–30k rows/sec — fine when run per-country.

### 9.4 GeoNames populationScore stage (Tier 3b) — extends Stage 5

For Tier-2 countries (no Census/StatCan equivalent):

1. Download GeoNames `cities500.zip` (CC-BY 4.0, ~200k places: name, asciiname, alternatenames, country, admin1, population, lat/lon).
2. Load into temp table `geonames_places`; index on `(country, lower(asciiname))` and a GiST point index.
3. Two-pass join, locality-level (clean-ish — names + containment, not address fuzzing):
   ```sql
   -- Pass 1: exact name match within country + same admin1 where mapped
   UPDATE addresses_staging a SET population_score = g.population
   FROM geonames_places g
   WHERE a.source='OVERTURE' AND a.population_score=0
     AND g.country = a.country AND lower(g.asciiname) = lower(a.locality);
   -- Pass 2 (fallback): nearest GeoNames place within 15km
   UPDATE addresses_staging a SET population_score = g.population
   FROM LATERAL (
     SELECT population FROM geonames_places g
     WHERE g.country = a.country
     ORDER BY g.geom <-> ST_MakePoint(a.longitude, a.latitude) LIMIT 1
   ) g
   WHERE a.source='OVERTURE' AND a.population_score=0; -- + distance guard
   ```
4. Record join hit-rate per country in the manifest (validation gate: flag countries <80%).

GeoNames also carries **attribution obligation (CC-BY)** — add to the same attribution page as Overture/OpenAddresses (assessment §4.10).

### 9.5 Updated module layout

```
scripts/intl/
  01-download.sh           # NAD/ODA/Census/GeoNames pulls (Overture needs none — reads S3)
  02-stage.ts              # orchestrator: registry → adapter → \copy, manifest-resumable
  05-libpostal.ts          # Tier-3a derivation (street_type/flat from strings)
  03-enrich.sql            # Stage 5: Census/StatCan joins (Tier-1) 
  03b-enrich-geonames.sql  # Stage 5: GeoNames joins (Tier-2)
  04-promote.sql           # Stage 6 + index rebuild
  adapters/
    nad.ts  oda.ts  overture.ts
    parse-unit.ts
  lib/
    source-registry.ts     # tier precedence per country
    state-codes.ts         # FIPS/PRUID/ISO-3166-2 mappings per enabled country
    dedup.ts
manifest.json              # per-country: source, release/version, rows, geonames hit-rate, status
```

### 9.6 Per-country rollout checklist (gate before enabling a country)

1. Registry entry (tier + adapter) and **state-code mapping exists**.
2. Pull a 1k-row sample via the adapter; eyeball street/locality/state quality.
3. Confirm libpostal handles the language's street-type position (prefix vs suffix).
4. GeoNames hit-rate ≥80% on sample (else investigate locality naming).
5. Estimate row count (Overture per-country counts are published) → Neon cost check.
6. Load → validate Stage 9 (geocode/reverse/autocomplete spot checks) → mark done in manifest.

### 9.7 Known limits carried forward
- UK & uncovered countries: out of scope for this pipeline (no open source); requires OSM (ODbL legal review) or licensed data — separate decision.
- `numberLast`, `level_type` outside Tier-1: stay null.
- Overture is Alpha-status for addresses; pin releases, re-validate on upgrade.

## 10. Minimal v1 vs full
- **v1 (validate fast):** one US state (NAD) + one CA province (ODA), no population/ZCTA enrichment, default `confidence`/`populationScore`. Proves the mapping + COPY path end-to-end.
- **Full:** all states/provinces + Stages 5/8 enrichment + optional ZCTA backfill.
