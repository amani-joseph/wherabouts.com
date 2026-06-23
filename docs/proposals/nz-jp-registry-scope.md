# Registry change scope — add NZ + JP (Overture adapter)

_Scope only. Ingestion writes to the shared prod DB and requires explicit approval
(see memory: "DB changes require approval"). Both countries load through the existing
`overture` adapter — no new loader code._

## 0. Probe — RESOLVED 2026-06-24 ✅

The adapter sets `locality = address_levels[last]` and only fills `state` when
`state: "address-level-1"` AND `address_levels[1]` is already a short value (≤10 chars).
It does **not** map via `stateCodes`. The probe below (full-scan of the pinned release,
minutes-long, S3-bound) was run; results decide the `state` mapping.

```sql
LOAD spatial; LOAD httpfs; SET s3_region='us-west-2';
SELECT
  country,
  len(address_levels)                                   AS n_levels,
  count(*)                                              AS rows,
  count(*) FILTER (WHERE postcode IS NULL) * 100.0/count(*) AS nullpc,
  count(*) FILTER (WHERE street   IS NULL) * 100.0/count(*) AS nullst,
  any_value(address_levels[1].value)                   AS sample_lvl1,
  max(length(address_levels[1].value))                 AS max_lvl1_len,
  any_value(address_levels[len(address_levels)].value) AS sample_last
FROM read_parquet(
  's3://overturemaps-us-west-2/release/2026-05-20.0/theme=addresses/type=address/*',
  hive_partitioning=1)
WHERE country IN ('JP','NZ')
GROUP BY country, len(address_levels)
ORDER BY country, n_levels;
```

### Results (release `2026-05-20.0`)

| country | n_levels | rows | nullpc | nullst | sample_lvl1 | max_lvl1_len | sample_last |
|---|---:|---:|---:|---:|---|---:|---|
| JP | 2 (uniform) | 19,568,315 | **100%** | 0% | 沖縄県 (Okinawa-ken) | **4** | 南城市 (Nanjō city) |
| NZ | 2 | 2,410,606 | **100%** | 0% | Lower Hutt | **48** | Wainuiomata Coast |

### Decisions

- **JP → `state: "address-level-1"`.** lvl1 is the prefecture in kanji (max 4 chars,
  passes the ≤10 guard) with a uniform 2 levels, so `state` = prefecture and
  `locality` = municipality. This preserves the prefecture; `"none"` would have dropped it.
  (The original "must be a Latin code" rule was too strict — a short kanji name works.)
- **NZ → `state: "none"`.** lvl1 (city/territorial authority) runs to 48 chars, far over
  the varchar(10)/≤10 guard, so `address-level-1` would blank most rows. `"none"` matches
  the DK/HR/FO long-lvl1 precedent. The city is dropped; `locality` = suburb.

### ⚠️ Postcodes: both 100% null

Neither JP nor NZ ships **any** postcodes in Overture (worse than DE's 79%). Postcode-based
geocoding/search will not work for either until an authoritative upgrade:
- **JP** → Digital Agency Address Base Registry (has postcodes)
- **NZ** → LINZ NZ Street Address, CC-BY (has postcodes + city)

`street` is always present (nullst 0%) for both.

## 1. `scripts/intl/lib/source-registry.ts` — APPLIED 2026-06-24 ✅

Two entries added to `COUNTRIES` (inserted after `SK`, before `CA`):

```ts
	NZ: {
		adapter: "overture",
		// Probed 2026-06-24 (release 2026-05-20.0): 2 lvls but lvl1 = territorial
		// authority/city up to 48 chars (exceeds the varchar(10)/<=10 guard) -> none,
		// matching the DK/HR/FO long-lvl1 precedent. The city is dropped; locality = suburb.
		state: "none",
		notes:
			"Overture 2.41M. 2 lvls: lvl1=city/territorial-authority (long, dropped) -> " +
			"none; last=suburb -> locality. nullpc 100% (NO postcodes in Overture — " +
			"postcode search won't work), nullst 0%. LINZ NZ Street Address (CC-BY) adds " +
			"postcodes + city — authoritative upgrade later via --replace.",
	},
	JP: {
		adapter: "overture",
		// Probed 2026-06-24 (release 2026-05-20.0): uniform 2 levels, lvl1 = prefecture
		// in kanji (max 4 chars, passes the <=10 guard) -> state; last = municipality.
		state: "address-level-1",
		notes:
			"Overture 19.57M (DE-sized, single extract — no state chunking needed). 2 lvls: " +
			"lvl1=prefecture (kanji, <=4 chars) -> state; last=municipality (市/区/町) -> " +
			"locality. nullpc 100% (NO postcodes in Overture — postcode search won't work), " +
			"nullst 0%. Non-Latin (kanji) in state/locality/street — autocomplete weak until " +
			"input normalizer. Digital Agency Address Base Registry adds postcodes — " +
			"authoritative upgrade later.",
	},
```

No change to `OVERTURE_RELEASE` (both predate `2026-05-20.0`).
No change to `AdapterName` (both use `overture`). Type-checks clean (`tsc --noEmit`).

## 2. `scripts/intl/run-queue.ts` (optional, ordering only)

Loads are normally invoked with `--countries NZ,JP`, which already filters to
`overture` countries, so this is optional. To keep `DEFAULT_ORDER` smallest-first
accurate, insert:
- `"NZ"` after `"AT"` (NZ ~2.4M ≈ AT 2.5M / RS 2.68M)
- `"JP"` after `"DE"` (JP ~19.6M ≈ DE 19.3M; below IT/FR ~26M)

JP needs no `us-queue.ts`-style per-state chunking — at 19.6M it's a single extract
like DE (19.3M) and IT/FR (~26M).

## 3. Run + verify (after approval)

```bash
# smallest first so NZ validates the path before the big JP load
bun scripts/intl/run-queue.ts --db @./.neon-url --countries NZ,JP
```

Rollout checklist per country (spec §9.6) before declaring done:
- **State mapping** — NZ none ✓; JP address-level-1 (prefecture) ✓ — both resolved (§0).
- **Sample eyeball** — `/geocode` + autocomplete a known NZ address and a known JP
  address; confirm state(JP)/locality/street render (mind kanji). Expect no postcode match.
- **GeoNames hit-rate** — spot-check populationScore enrichment.
- **Neon cost** — NZ trivial; JP ~19.6M rows (~DE-scale). Watch CU during the JP load;
  the campaign already ran at 8–16 CU.

## 4. Estimated impact

| Country | Overture rows | Effort | Risk |
|---|---:|---|---|
| NZ | 2.41M | trivial (single small extract) | low — but 0% postcodes; city dropped |
| JP | 19.57M | single extract, DE-scale | medium — kanji script + 0% postcodes |

**Cross-cutting caveat:** both load with **zero postcode coverage** (§0). If postcode
search/geocoding for JP or NZ is a requirement, prefer the authoritative upgrades (Digital
Agency for JP, LINZ for NZ) over — or as a `--replace` follow-up to — the Overture load.
