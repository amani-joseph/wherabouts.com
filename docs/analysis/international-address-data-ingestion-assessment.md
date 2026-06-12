# International Address Data — Ingestion Assessment & Plan

**Date:** 2026-06-11
**Author:** assessment for adding US + Canada (OpenAddresses) and refreshing AU (G-NAF Feb 2026)
**Scope reviewed:** `addresses` schema, `scripts/import-gnaf.ts` (proven ETL), and the 5 source archives.

---

## 1. What the data actually is

| Archive | Size (zip) | Format | What it contains |
|---|---|---|---|
| `g-naf_feb26_allstates_gda94_psv_1022.zip` | 1.6 GB | **G-NAF PSV** (pipe-separated), per state | `*_ADDRESS_DEFAULT_GEOCODE`, `*_ADDRESS_SITE_GEOCODE`, `*_LOCALITY_POINT`, `*_STREET_LOCALITY_POINT`. This is the **same source you already load** — it is the **Feb 2026 refresh** of AU data. |
| `collection-ca.zip` | 1.9 GB | **OpenAddresses** line-delimited GeoJSON | `ca/<prov>/<place>-addresses-*.geojson` + `-parcels-*.geojson` + `.meta`. Includes a 5 GB **`countrywide-addresses-country.geojson`** PLUS per-province PLUS per-city files (heavy overlap). |
| `collection-us-northeast.zip` | 2.0 GB | OpenAddresses GeoJSON | `us/<state>/<county>-addresses-county.geojson` + parcels + meta |
| `collection-us-midwest.zip` | 5.0 GB | OpenAddresses GeoJSON | same layout |
| `collection-us-south.zip` | 12 GB | OpenAddresses GeoJSON | same layout |

**OpenAddresses address feature shape** (one JSON object per line):
```json
{"type":"Feature","properties":{"hash":"…","number":"","street":"","unit":"",
 "city":"","district":"","region":"","postcode":"","id":""},
 "geometry":{"type":"Point","coordinates":[lon,lat]}}
```
**Parcels feature shape** = `Polygon` geometry + `{hash, pid}` only — **no address fields**.

---

## 2. Question 1 — Can the current schema hold this? **Yes, with caveats.**

The `addresses` table (`packages/database/src/schema/addresses.ts`) is generic, not AU-locked. Field mapping:

| `addresses` column | G-NAF (today) | OpenAddresses (US/CA) | Note |
|---|---|---|---|
| `country` varchar(2) NN | `AU` | `us` / `ca` (uppercase it) | ✅ |
| `state` varchar(10) NN | ACT/NSW/… | **derive from file path** `us/pa/` → `PA` | ⚠️ `region` property is often empty — do NOT trust it |
| `locality` text NN | locality | `city` | ⚠️ frequently empty → default `''` |
| `postcode` varchar(10) NN | postcode | `postcode` | ⚠️ frequently empty → default `''` |
| `streetName` text NN | street name | `street` (whole string) | ⚠️ OA does not split type/suffix |
| `streetType`/`streetSuffix` | populated | **null** | parity gap (see §4) |
| `flatNumber` etc. | populated | `unit` → `flatNumber`, rest null | ✅ partial |
| `numberFirst` varchar(15) | number first | `number` | ✅ |
| `numberLast` | number last | null | ✅ |
| `longitude`/`latitude` real NN | geocode | `coordinates[0]/[1]` | ✅ both WGS84/EPSG:4326 |
| `geom` Point,4326 | built | `ST_MakePoint(lon,lat)` | ✅ same SRID |
| `confidence` int | set | **null** (OA has none) | ✅ nullable |
| `gnafPid` varchar(30) | set | **null** | ✅ nullable |
| `populationScore` int NN dflt 0 | computed | default 0 (needs a scheme) | ⚠️ ranking, see §4 |
| `adminLevel` int NN dflt 5 | computed | default 5 | ⚠️ |
| `searchText` text | generated | must generate same way | ⚠️ |

**Conclusion:** No migration required for addresses. Three `NOT NULL` text columns (`locality`, `postcode`, `streetName`) must be defaulted to `''` and the loader must **skip features that have neither `number` nor `street`** (pure geometry points — useless for geocoding).

**Parcels are NOT compatible** with `addresses` (Polygon vs Point, no address fields). They are out of scope for this table — either skip them or load them into a separate parcels table later.

---

## 3. Question 2 — Programmatic ingestion plan

Reuse the **proven `import-gnaf.ts` pattern**: stream source → write a clean CSV → `psql \copy` into a staging table → `INSERT … SELECT` into `addresses` building `geom` with `ST_SetSRID(ST_MakePoint(...),4326)`. HTTP/`neon-http` inserts are ~100× slower and `neon-http` has no transactions — **COPY via `psql` is the only sane path at this volume.**

### Step 0 — AU refresh (do this first, it's the known-good path)
Re-run `scripts/import-gnaf.ts` against the Feb 2026 zip. Decide truncate-and-reload vs upsert by `gnafPid`. This validates the pipeline before adding new countries.

### Step 1 — New loader `scripts/import-openaddresses.ts`
1. **Stream from the zip without full extraction** (`unzip -p <zip> <entry>` piped, or `yauzl`/`unzipper`). The US-South zip is 12 GB compressed and tens of GB uncompressed — **do not extract everything to disk**.
2. **Pick ONE coverage tier per area to avoid duplication** (critical, see §4): the collections ship country + state + county/city files that overlap. Recommended: for **US** use `*-addresses-county.geojson` and skip `statewide-addresses-state`; for **CA** use the per-province/city `*-addresses-*` files and **skip the 5 GB `countrywide-addresses-country.geojson`** (or vice-versa — but never both).
3. For each `*-addresses-*.geojson` (skip `*-parcels-*` and `.meta`):
   - Derive `country` + `state` from the path segments (`us/pa/…`, `ca/qc/…`).
   - Parse each line as JSON; skip if `number==='' && street===''`; skip null/`[0,0]` coords.
   - Emit a CSV row: `country, state, locality(city||''), postcode||'', streetName(street), null type/suffix, unit→flatNumber, number→numberFirst, lon, lat, null confidence, null gnafPid, searchText, populationScore(0), adminLevel(5)`.
   - Build `searchText` with the **same normalization** the API's autocomplete/search expects (check `packages/database/src/queries/autocomplete.ts`).
4. `psql \copy addresses_staging FROM file CSV`, then `INSERT INTO addresses (…, geom) SELECT …, ST_SetSRID(ST_MakePoint(longitude,latitude),4326)` in batches; build the GiST indexes **after** the bulk load, not during.

### Step 2 — Run order & batching
Load smallest first to shake out bugs: `collection-ca` → `us-northeast` → `us-midwest` → `us-south`. Load per-file so a failure is resumable; track completed files.

### Step 3 — Post-load
Rebuild/`ANALYZE` indexes (esp. the two GiST geom indexes), spot-check `/geocode`, `/reverse`, `/nearby`, autocomplete for a US + CA address. Update any `regions` rows if the API exposes a country/region list.

---

## 4. Gotchas & caveats (read before starting)

1. **VOLUME — the big one.** AU today ≈ 5.6 M rows. Full US + CA OpenAddresses is on the order of **hundreds of millions** of address points (US-South alone is 12 GB zipped). This dwarfs current data. Implications:
   - **Neon storage + cost** will jump dramatically (likely 100 GB+ table + index). Confirm the plan/quota first.
   - **GiST geom + geography index build** on hundreds of millions of rows is slow and memory-hungry. Build after load; consider per-country partitioning if query latency degrades.
   - **Autocomplete/search latency** is tuned for 5.6 M rows — re-benchmark after load; the `populationScore`/`adminLevel` ranking was AU-calibrated.
   - Consider whether you actually need *all* of it now, or a subset (e.g. CA + US-Northeast) for a first release.
2. **Duplication across tiers** (country vs state vs county/city files overlap). Loading all tiers multiplies row counts and creates duplicate addresses. **Choose one tier per area.**
3. **`region` property is unreliable / often empty** → always derive `country`/`state` from the **file path**, never the property.
4. **Empty / geometry-only sources.** Many OA files (e.g. `ca/yt/whitehorse`) have *every* address field blank — the sampled file's meta showed 9,832/9,832 `number` & `street` validation failures. The skip rule in Step 1.3 handles this, but expect to drop a meaningful fraction of features.
5. **NOT NULL columns** (`locality`, `postcode`, `streetName`) — default empties to `''`; never insert NULL there.
6. **Parity gap:** OA has no street type/suffix split, no `confidence`, no stable PID. US/CA rows will rank/format slightly differently than AU. Decide if the API/SDK response contract needs a per-country note.
7. **Datum:** OA is EPSG:4326 (matches `geom`). ✅ No reprojection. (G-NAF is GDA94 — already handled by the existing script.)
8. **Disk/IO:** stream from the zips; don't unzip 12 GB to local disk. Ensure enough scratch space for the intermediate CSVs (or pipe CSV straight into `psql \copy` via stdin).
9. **Idempotency/resume:** load per-file and record progress so a mid-run failure doesn't force a full restart. The COPY path uses `psql` directly (not `neon-http`), so the "no transactions on neon-http" limitation does not apply here.
10. **Licensing/attribution:** OpenAddresses sources carry per-source licenses (the `.meta` files reference them). Confirm attribution obligations before exposing this data via a paid API.

---

## 6. Alternative datasets that fully satisfy the schema columns

OpenAddresses fills only ~6 of the address-component columns (no street type/suffix, no building/level, often no postcode). Two **authoritative, free, downloadable national datasets** fill nearly all of them — they are the right substitutes for the US + CA OpenAddresses collections.

> Note: `gnafPid` (G-NAF's own key), `geom`, `searchText`, `populationScore`, `adminLevel` cannot come from *any* external source — they are AU-specific or loader-computed. "Fully satisfy" below means the **source-derived address columns**.

### US — National Address Database (NAD), US DOT
- **License:** public domain (US Government). **Size:** ~67M points, updated quarterly (last: 2026-03-31).
- **Download:** `transportation.gov/gis/national-address-database` — Esri File Geodatabase (full or per-state), also mirrored at `nationaladdressdata.s3.amazonaws.com`, plus an ArcGIS REST FeatureServer.

| `addresses` column | NAD field | Match |
|---|---|---|
| country | (constant `US`) | ✅ |
| state | `State` | ✅ |
| locality | `Post_City` / `Inc_Muni` | ✅ |
| postcode | `Zip_Code` (+`Plus_4`) | ✅ |
| streetName | `St_Name` / `StNam_Full` | ✅ |
| streetType | `St_PosTyp` | ✅ (direct equiv of G-NAF STREET_TYPE_CODE) |
| streetSuffix | `St_PosDir` | ✅ (equiv of STREET_SUFFIX_CODE) |
| buildingName | `Building` | ✅ |
| flatNumber | `Unit` | ✅ |
| levelNumber | `Floor` | ✅ |
| numberFirst | `Add_Number` / `AddNo_Full` | ✅ |
| longitude/latitude | `Longitude` / `Latitude` | ✅ |
| numberLast | — (US rarely uses ranges) | ⚠️ usually empty |
| flatType / levelType | merged into `Unit`/`Floor` strings | ⚠️ no separate code |
| confidence | — (has `AddrClass`/`Placement`, not numeric) | ⚠️ leave null |

**Verdict:** NAD populates **every address column the schema actually uses**, including the ones OpenAddresses lacks (street type, suffix, building, floor). Closest possible match to a flattened G-NAF row.

### Canada — Open Database of Addresses (ODA), Statistics Canada
- **License:** Open Government Licence – Canada. **Size:** ~10M records (v1.0). **Download:** `statcan.gc.ca/en/lode/databases/oda` — CSV per province/territory.
- **Fields:** Civic Number, Street Name, **Street Type**, **Street Direction**, **Unit**, **Postal Code**, City, Province ID, Lat/Lon.

| `addresses` column | ODA field | Match |
|---|---|---|
| numberFirst | Civic Number | ✅ |
| streetName | Street Name | ✅ |
| streetType | Street Type | ✅ |
| streetSuffix | Street Direction | ✅ |
| flatNumber | Unit | ✅ |
| postcode | Postal Code | ✅ (OpenAddresses CA usually lacks this) |
| locality | City | ✅ |
| state | Province/Territory ID (map PRUID → 2-letter) | ✅ |
| longitude/latitude | Longitude / Latitude | ✅ |
| buildingName, flatType, levelType/levelNumber, numberLast, confidence | — | ⚠️ absent |

**Verdict:** Substantially richer than OpenAddresses CA (adds street type, direction, **and postal codes**). Missing only building/level/confidence — same as NAD.

### Recommendation
Replace the OpenAddresses collections with **NAD (US) + ODA (Canada)**. Together they cover exactly the two countries you're adding, are authoritative, openly licensed, and populate ~12 of your ~14 source-derived columns vs ~6 for OpenAddresses. The remaining gaps (`numberLast`, separate `flatType`/`levelType`, `confidence`) are nullable and don't block geocoding. Both still need a **new loader** (NAD = read FileGDB/GeoServices; ODA = CSV) — but the destination COPY pipeline from §3 is unchanged. No single *global* dataset matches G-NAF's richness; per-country authoritative sets like these are the realistic path.

---

## 7. Can multiple datasets be combined to fully cover the schema?

Short answer: **yes, but the join is the hard part.** Address datasets share no common primary key, so merging two *raw address* sources means matching on (a) spatial proximity (`ST_DWithin` on points) or (b) a normalized address string — both fuzzy, both produce false matches and duplicates. So the rule is: **derive from fields you already have wherever possible; only add a new dataset when it joins on a clean tabular key.**

### Gap-by-gap fill strategy (after NAD/ODA are loaded)

| Remaining gap | Best way to fill it | Needs a *new* dataset? | Join difficulty |
|---|---|---|---|
| `flatType` (vs merged `Unit`) | Parse NAD `Unit` / ODA `Unit` string (`"APT 3"` → type=`APT`, number=`3`) | No — derivation | none |
| `levelType` (vs merged `Floor`) | Parse NAD `Floor` / `Room` string | No — derivation | none |
| `confidence` | Compute from NAD `Placement`/`AddrClass`, **or cross-source agreement** (two sources agree on a point ⇒ high confidence) | Optional | spatial (fuzzy) |
| `populationScore` | US Census place population; StatCan census | **Yes** — Census place table | **clean** (join on place/CSD code) |
| `adminLevel` | Derive from which admin layer the point fell in | No — derivation | none |
| `postcode` (where empty) | ZIP/postal centroid backfill (USPS/Census ZCTA) | Yes | clean (point-in-polygon) |
| `numberLast` (ranges) | Census TIGER/Line address ranges | Yes | hard (segment-level, not point) |
| `gnafPid` | n/a — AU-only key | — | impossible |

### The two kinds of "combining"

1. **Clean tabular enrichment (recommended).** Join on an administrative code, not on the address itself: e.g. attach Census **place population** → `populationScore`, ZCTA polygons → backfill `postcode`. Deterministic, no fuzzy matching, low risk. This is the safe way to use "multiple datasets."
2. **Address-point conflation (use sparingly).** Merging two raw address sources (e.g. NAD ⨝ OpenAddresses) to fill missing components or cross-validate. This needs spatial/string matching with conflict-resolution rules ("which source wins"), dedup, and tolerance for false joins. High complexity; reserve it for `confidence` cross-validation or filling specific high-value holes — not as the primary pipeline.

### Verdict
You can reach **effectively full coverage** of the schema's *meaningful* columns by: **NAD/ODA** (core components) + **string parsing** (`flatType`/`levelType`/`adminLevel`) + **one clean tabular join** to Census population (`populationScore`) + optional ZCTA backfill (`postcode`). That covers everything except `gnafPid` (AU-only, correctly null) and `numberLast` (rare for US/CA points). **You do not need a second raw address dataset** to "fill" most gaps — derivation does it without the conflation cost. Add raw-address conflation only if you later want cross-source `confidence`.

---

## 8. Rest-of-world strategy — global coverage conforming to the current schema

### The one global backbone: Overture Maps — Addresses theme
- **~446M address points, 175+ sources** (OpenAddresses, AddressForAll, **US NAD**, NYC, many national agencies), monthly releases, **GeoParquet on S3/Azure** — query/download per-country with DuckDB, no bulk unzip. Verified May 2026 release.
- **Schema (verified):** `country` (ISO alpha-2), `address_levels[]` (state → locality, ordered general→specific), `number`, `street`, `unit`, `postcode`, Point geometry (4326), GERS `id`, per-feature `sources[]`.
- **Maps to `addresses`:** country, state (`address_levels[0]`), locality (last level), postcode, streetName (`street`), numberFirst (`number`), flatNumber (`unit`), lon/lat/geom, plus a stable GERS id (could go in a future `sourceId` column). Same parity gaps as OpenAddresses: **no streetType/suffix/level split, no confidence**.
- Effectively a *clean, deduplicated, monthly-updated superset of the OpenAddresses zips you downloaded* — strictly better than loading the collection zips.

### Why no single dataset can "fully" satisfy the schema globally
The structured columns (`streetType`, `streetSuffix`, `flatType`, `levelType`, `confidence`) only exist in **rich national cadastral/address registers**, and only some countries publish one openly. There is no global source with G-NAF-level structure. Hence a **3-tier merge**:

| Tier | Source | Countries | Columns filled |
|---|---|---|---|
| 1 — Rich national registers | G-NAF (done), **US NAD**, **CA ODA**, FR BAN, NL BAG, DK DAR, ES Catastro, etc. | ~10–15 best markets | nearly all |
| 2 — Overture backbone | Overture Addresses | every other covered country (AT, BE, BR, CL, CO, CZ, DE, EE, FI, HR, IS, IT, JP, …) | core 8–9 columns |
| 3 — Derivation + enrichment | **libpostal** (parse `street`→ name/type/suffix; `unit`→ flat), **GeoNames** (population by place, CC-BY → `populationScore`), ZCTA-style postal backfill where available | applied on top of Tiers 1–2 | streetType/suffix, flatType, populationScore |

Precedence rule per country: Tier 1 if available, else Tier 2; Tier 3 always runs. All tiers emit the same canonical staging row from §3 of the pipeline spec — **no schema change**.

### Honest caveats
1. **Coverage holes are real:** Overture's country table shows where open address data simply doesn't exist (e.g. **UK** — AddressBase is paid-only; much of Africa, Middle East, South/Southeast Asia). For those: OSM `addr:*` points (ODbL — **check share-alike implications for a commercial API**) or licensed data; otherwise accept gaps and document supported countries.
2. **libpostal-derived street types are inferred, not authoritative** — fine for search/display, label them lower `confidence`.
3. **`address_levels` semantics vary by country** (1–5 levels) — the adapter must map per-country, and `state varchar(10)` needs a per-country code mapping (some countries have long region names → store ISO 3166-2 suffix codes).
4. Volume: 446M rows ≫ current 5.6M — the Neon cost/index concerns from §4 apply ~80-fold; load country-by-country, on demand.

---

## 5. Recommended decisions before coding
- Confirm **Neon storage/cost** headroom for hundreds of millions of rows.
- Choose **coverage scope** for v1 (all of US+CA, or a subset).
- Choose **tier strategy** (county-level for US; province/city for CA — skip countrywide).
- Decide **parcels**: skip for now (recommended) or scope a separate table.
- Decide AU refresh strategy: **truncate-reload vs upsert by `gnafPid`**.
