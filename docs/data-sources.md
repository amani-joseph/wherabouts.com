# Address Data Sources Registry

**Purpose:** internal operations registry for every dataset behind the `addresses` table — where it comes from, what version we loaded, how to check for updates, and which schema columns each source can satisfy. Attribution fields are structured so this doc can seed the public attribution page later.

**Maintenance:** update when a source is added/upgraded or a new version is loaded. Per-run actuals (row counts, release used, target host, timestamps) live in `scripts/intl/manifest.json` — this doc records the stable facts, the manifest records history.

---

## 0. Loaded state (US complete 2026-06-15)

**Production `addresses` table: ~299.5M rows · 28 countries · 153 GB.** US added all 50 states + DC + VI (~124M rows, Overture) on top of the prior 28-country / 175M base. Neon compute raised to **8–16 CU** during the US giants (CA/TX/FL promotes were cache-bound at 130+ GB on 8 CU; CA took 2.5h+ before the bump, then committed on 16 CU). **Decide steady-state compute** now that the table is 153 GB.

US load specifics: state-by-state via `us-queue.ts` (resumable, smallest-first). Findings fixed mid-load: postcode length-guard (MS had a 21-char malformed blob), and the giant-state promotes exposed that on 8 CU the index working set thrashes — the 16 CU bump (range capped at max−min ≤ 8, so 8–16) resolved CA.

### Prior milestone (28 countries complete 2026-06-14)
**175,257,723 rows · 27 non-US countries + AU · 86 GB.** Neon was at 4–8 CU; warm proximity latency ~58 ms post-load.

Per-country actual loaded counts (after extract-stage dedup):

| CC | Rows | CC | Rows | CC | Rows |
|---|---|---|---|---|---|
| AU | 16,841,097 | FR | 26,055,819 | NL | 9,888,467 |
| DE | 19,259,591 | IT | 25,913,333 | PL | 8,528,566 |
| ES | 15,656,293 | CA | 10,050,845 | BE | 6,696,054 |
| PT | 5,595,089 | FI | 3,599,037 | NO | 3,579,905 |
| DK | 3,933,282 | CH | 3,288,025 | CZ | 3,014,719 |
| AT | 2,516,318 | RS | 2,672,273 | EE | 2,183,077 |
| SK | 1,697,459 | HR | 1,679,224 | LT | 1,125,012 |
| SI | 579,011 | LV | 548,408 | LU | 179,051 |
| IS | 138,522 | FO | 26,300 | LI | 12,946 |

Known follow-ups: ① Tier-1 upgrades pending for US (NAD) and FR/NL (BAN/BAG) — see §4. ② Enrichment stages (libpostal street-type, GeoNames populationScore) not yet run — §4. ③ CA gap: ODA v1 has no NL/YT/NU. ④ Neon password rotation pending (held by user).

---

## 1. Live sources

| Source | Countries | Loaded version | Cadence | Update check | License / attribution |
|---|---|---|---|---|---|
| **G-NAF** (Geoscape, via data.gov.au) | AU | Feb 2026 | Quarterly (Feb/May/Aug/Nov) | https://data.gov.au/dataset/ds-dga-19432f89-dc3a-4ef3-b943-5326ef1dbecc (G-NAF dataset page) | [G-NAF EULA](https://geoscape.com.au/legal/g-naf-end-user-licence-agreement/) — attribution required: "Incorporates or developed using G-NAF © Geoscape Australia" |
| **Overture Maps — Addresses theme** | 24 EU countries: AT BE CH CZ DE DK EE ES FI FO FR HR IS IT LI LT LU LV NL NO PL PT RS SI SK *(IS+LU first; rest via Europe campaign)* | `2026-05-20.0` (pinned in `source-registry.ts`) | Monthly | `SELECT latest FROM 'https://stac.overturemaps.org/catalog.json'` (DuckDB one-liner); release notes at https://docs.overturemaps.org/release-notes/ | Aggregate of 175+ open sources — attribution per https://docs.overturemaps.org/attribution/ |
| **StatCan ODA** (Open Database of Addresses) | CA (10 of 13 provinces/territories — **no NL/YT/NU**) | v1 (2021) | ⚠️ One-shot — v1 is final; successor is the **National Address Register (NAR)**, watch https://www.statcan.gc.ca/en/lode | https://www.statcan.gc.ca/en/lode/databases/oda (per-province zips: `ODA_<PROV>_v1.zip`) | Open Government Licence – Canada; **per-source attribution statements in each zip's `Data_Sources.csv`** |

### Download URLs (exact)
- G-NAF: via data.gov.au → "G-NAF Core" or full PSV (e.g. `g-naf_feb26_allstates_gda94_psv_1022.zip`)
- Overture: `s3://overturemaps-us-west-2/release/<RELEASE>/theme=addresses/type=address/*` (public bucket, query with DuckDB — no bulk download needed)
- ODA: `https://www150.statcan.gc.ca/n1/en/pub/46-26-0001/2021001/ODA_{AB,BC,MB,NB,NT,NS,ON,PE,QC,SK}_v1.zip`

---

## 2. Column coverage by source

Legend: ✅ provided by source · 🔧 computed by loader today · 🟡 derivable, not yet built (planned stage) · ❌ not available / impossible · ⬜ always null for this source

| `addresses` column | G-NAF (AU) | Overture (EU) | ODA (CA) | NAD (US, future) |
|---|---|---|---|---|
| country | ✅ const | ✅ | ✅ const | ✅ const |
| state | ✅ | ✅ DE only (2-char Land codes); ⬜ others (1-level addressing) | ✅ (PRUID→code) | ✅ `State` |
| locality | ✅ | ✅ (last `address_levels` entry) | ✅ `city_pcs` | ✅ `Post_City`/`Inc_Muni` |
| postcode | ✅ | ✅ (quality varies — see §3) | ✅ where provider supplied (PE: none) | ✅ `Zip_Code` |
| streetName | ✅ | ✅ `street` (embeds type) | ✅ `str_name_pcs` | ✅ `St_Name` |
| streetType | ✅ | 🟡 libpostal parse of `street` | ✅ `str_type_pcs` | ✅ `St_PosTyp` |
| streetSuffix | ✅ | 🟡 libpostal | ✅ `str_dir_pcs` | ✅ `St_PosDir` |
| buildingName | ✅ | ❌ | ❌ | ✅ `Building` |
| flatType | ✅ | 🟡 parse `unit` | 🟡 parse `unit` | 🟡 parse `Unit` |
| flatNumber | ✅ | ✅ `unit` (≤10 chars) | ✅ `unit` | ✅ `Unit` |
| levelType / levelNumber | ✅ | ❌ | ❌ | ✅ `Floor` (number; type 🟡) |
| numberFirst | ✅ | ✅ `number` | ✅ `street_no` | ✅ `Add_Number` |
| numberLast | ✅ | ❌ (ranges rare) | ❌ | ❌ (rare) |
| longitude / latitude | ✅ | ✅ | ✅ | ✅ |
| geom | 🔧 `ST_MakePoint` | 🔧 | 🔧 | 🔧 |
| confidence | ✅ | 🟡 (=50 for libpostal-derived rows, planned) | ⬜ | 🟡 from `Placement`/`AddrClass` |
| gnafPid | ✅ (G-NAF's own PK) | ❌ impossible | ❌ impossible | ❌ impossible |
| searchText | 🔧 promote SQL (`0004` formula + NULLIF) | 🔧 | 🔧 | 🔧 |
| populationScore | ✅ (AU pipeline) | 🟡 GeoNames `cities500` join (spec §9.4) | 🟡 StatCan census by CSDUID | 🟡 US Census place pop |
| adminLevel | 🔧 | 🔧 const 5 | 🔧 const 5 | 🔧 const 5 |
| *(staging only)* source_id | — | GERS id (kept in staging, not promoted) | ODA `id` | NAD `UUID` |

---

## 3. Per-country quality & configuration

Source probe: `docs/analysis/probe-europe-2026-06-12.csv` (Overture `2026-05-20.0`, single full scan). Row counts are Overture-published; actual loaded counts in `manifest.json`.

| CC | Source | Rows (~) | State mode | Null postcode | Null street | Null number | Notes |
|---|---|---|---|---|---|---|---|
| AU | G-NAF | 16.8M | native | — | — | — | Original dataset; full column richness |
| AT | Overture | 2.5M | none | 0% | 0% | 0% | 2 lvls but lvl1=municipality |
| BE | Overture | 6.7M | none | 0% | 0% | 0% | |
| CA | ODA | ~10M | PRUID→code | varies (PE 100%) | ~0% | ~0% | **No NL/YT/NU**; `_pcs` fields used |
| CH | Overture | 3.3M | none | 0% | 0% | 0.6% | |
| CZ | Overture | 3.0M | none | 0% | **47.8%** | 0% | Rural number-only addressing |
| DE | Overture | 19.3M | **address-level-1** | **79.3%** | 0% | 0% | Only EU country with state codes; postcode backfill candidate |
| DK | Overture | 3.9M | none | 0% | 0% | 0% | |
| EE | Overture | 2.2M | none | **100%** | 41.9% | 0.9% | 3 lvls, last=settlement |
| ES | Overture | 15.7M | none | 0% | 0% | 0.3% | |
| FI | Overture | 3.6M | none | 0% | 0% | 4.6% | Uppercase source |
| FO | Overture | 26k | none | 0% | 0% | 0% | |
| FR | Overture | 26.1M | none | 0% | 0% | 0% | Includes overseas territories (BAN-sourced) |
| HR | Overture | 1.7M | none | 0% | 0% | 0% | |
| IS | Overture | 139k | none | 0% | 0% | rural place-names | First smoke-test country |
| IT | Overture | 25.9M | none | **100%** | 0% | 0.1% | 3 lvls (region/province/comune) |
| LI | Overture | 13k | none | 0% | 0% | 0% | |
| LT | Overture | 1.1M | none | 0.1% | 6.5% | 0% | |
| LU | Overture | 179k | none | 0% | 0% | 0% | Prod canary |
| LV | Overture | 549k | none | 0% | 41.4% | 0% | |
| NL | Overture | 9.9M | none | 2.5% | 0% | 0% | |
| NO | Overture | 3.6M | none | 0% | 0.8% | 0% | Uppercase source |
| PL | Overture | 8.5M | none | 0% | **35.9%** | 0% | 3 lvls (powiat/gmina/town) |
| PT | Overture | 5.6M | none | 0% | 0.2% | **22.2%** | Street-level points kept |
| RS | Overture | 2.7M | none | **100%** | 0% | 0% | |
| SI | Overture | 579k | none | 0% | 0% | 0% | |
| SK | Overture | 1.7M | none | 0% | **55.5%** | 0% | |

**Countries with NO open address data** (not loadable from any source in this registry): UK & Ireland (AddressBase / Eircode are paid), Sweden, Greece, Romania, Bulgaria, Hungary, Ukraine, most of the Balkans (except RS/HR/SI), and most of Africa, the Middle East, and South/Southeast Asia. Options: OSM `addr:*` (ODbL — share-alike legal review needed for commercial API) or licensed data.

---

## 4. Future / upgrade sources (evaluated, not loaded)

| Source | Would replace / add | Size | Cadence | URL | Notes |
|---|---|---|---|---|---|
| **US NAD** (DOT) | US Tier-1 (approved next phase) | ~67M pts | Quarterly | https://www.transportation.gov/gis/national-address-database (FileGDB; also `nationaladdressdata.s3.amazonaws.com`, ArcGIS REST) | Public domain. Richest US source: street type/suffix, building, floor, unit. Needs own cost sign-off (~+35 GB) |
| **FR BAN** (Base Adresse Nationale) | FR Tier-1 upgrade | ~26M | Continuous (weekly exports) | https://adresse.data.gouv.fr/donnees-nationales | Licence Ouverte. Adds certified commune codes (INSEE); Overture FR already BAN-derived, so upgrade is low priority |
| **NL BAG** (Kadaster) | NL Tier-1 upgrade | ~9.9M | Monthly | https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/bag-2.0-extract | CC0-like. Adds building usage data |
| **StatCan NAR** (National Address Register) | CA — ODA's successor | TBD | TBD (announced) | https://www.statcan.gc.ca/en/lode | Watch for release; should fix the NL/YT/NU gap |
| **GeoNames `cities500`** | `populationScore` enrichment (spec §9.4) | ~200k places | Irregular (frequent) | https://download.geonames.org/export/dump/cities500.zip | CC-BY 4.0 — attribution required |
| **US Census place population** | `populationScore` for US | ~32k places | Decennial + ACS yearly | `https://api.census.gov/data/2020/dec/pl?get=NAME,P1_001N&for=place:*&in=state:*` | Public domain |
| **Census TIGER ZCTA** | postcode backfill (DE/IT/RS/EE have 79–100% null) — note: US polygons only; EU needs per-country postal polygons | — | Yearly | https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html | Public domain. EU equivalents: per-country (e.g. DE: OSM Boundaries/Datendienste) — research needed |
| **libpostal** | streetType/flatType derivation (spec §9.3) | lib + ~2GB models | Irregular | https://github.com/openvenues/libpostal | MIT. Installed locally; stage not yet implemented |

## 5. Rejected sources (and why — don't re-evaluate)

| Source | Rejected because |
|---|---|
| **OpenAddresses collection zips** (`collection-us-*.zip`, `collection-ca.zip`) | Superseded by Overture, which aggregates the same 175+ sources, deduplicates, adds GERS ids, and ships monthly GeoParquet (no 12 GB zip handling). Same column coverage. |
| **OpenAddresses parcels layers** | Polygon geometry + `{hash, pid}` only — no address fields; incompatible with `addresses` (Point). Would need its own table and a product reason. |
| **UK AddressBase / PAF** | Paid licensing only; no open UK address dataset exists. |
| **G-NAF for non-AU** | G-NAF is Australia-only (PSM/Geoscape). |

---

*Created 2026-06-13 during the Europe ingestion campaign (PR #8). Probe data: `docs/analysis/probe-europe-2026-06-12.csv`. Pipeline: `scripts/intl/`.*
