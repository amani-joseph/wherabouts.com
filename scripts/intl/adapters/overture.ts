/**
 * Overture Maps adapter — pulls one country's addresses straight from
 * Overture's public S3 GeoParquet via DuckDB, emitting the canonical
 * staging CSV (pipeline spec §9.2). No bulk download; DuckDB streams
 * only the matching rows.
 */

import { execFileSync } from "node:child_process";
import type { CountryConfig } from "../lib/source-registry";

const COORD_PRECISION = 7;
const WHITESPACE_RE = /\s+/;
const FLAT_NUMBER_MAX = 10;
const NUMBER_FIRST_MAX = 15;

export interface ExtractResult {
	csvPath: string;
	rowCount: number;
}

export function buildExtractSql(
	country: string,
	config: CountryConfig,
	release: string,
	outPath: string,
	stateFilter?: string
): string {
	// For huge countries (US, 126M rows) we load one state at a time so each
	// chunk is European-sized and resumable. stateFilter matches the same
	// expression we store in the `state` column (address_levels[1]).
	const statePredicate = stateFilter
		? `AND squash(address_levels[1].value) = '${stateFilter}'`
		: "";
	// Overture lvl1 values are short region codes in 2-level countries (e.g. US
	// "AZ", DE "NW"). Guards: require >=2 levels (in 1-level rows lvl1 IS the
	// locality, not a region) and length <=10 — never let long names into varchar(10).
	const stateExpr =
		config.state === "none"
			? "''"
			: "CASE WHEN len(address_levels) >= 2 AND length(squash(address_levels[1].value)) <= 10 THEN squash(address_levels[1].value) ELSE '' END";
	return `
-- squash: trim + collapse internal whitespace (source data sometimes has doubles)
CREATE OR REPLACE MACRO squash(x) AS COALESCE(trim(regexp_replace(x, '\\s+', ' ', 'g')), '');
LOAD spatial; LOAD httpfs; SET s3_region='us-west-2';
COPY (
  -- Dedup happens HERE (window function, O(n log n)) — the former Postgres-side
  -- ctid self-join DELETE went quadratic past ~6M staged rows (54+ min on BE).
  -- PARTITION BY treats NULLs as equal, matching the old IS NOT DISTINCT FROM.
  SELECT * EXCLUDE (rn) FROM (
    SELECT
      'OVERTURE' AS source,
      '${country}' AS country,
      ${stateExpr} AS state,
      squash(address_levels[len(address_levels)].value) AS locality,
      -- postcode is varchar(10); a few source rows carry malformed blobs in this
      -- field (e.g. MS "WEST POINT, MS. 39773", 21 chars) that overflow it and
      -- abort the whole COPY. >10 chars = not a real postcode -> empty it.
      CASE WHEN length(squash(postcode)) <= 10 THEN squash(postcode) ELSE '' END AS postcode,
      squash(street) AS street_name,
      NULL AS street_type, NULL AS street_suffix, NULL AS building_name,
      NULL AS flat_type,
      CASE WHEN length(squash(unit)) BETWEEN 1 AND ${FLAT_NUMBER_MAX} THEN squash(unit) ELSE NULL END AS flat_number,
      NULL AS level_type, NULL AS level_number,
      CASE WHEN length(squash(number)) BETWEEN 1 AND ${NUMBER_FIRST_MAX} THEN squash(number) ELSE NULL END AS number_first,
      NULL AS number_last,
      round(ST_X(geometry), ${COORD_PRECISION}) AS longitude,
      round(ST_Y(geometry), ${COORD_PRECISION}) AS latitude,
      NULL AS confidence,
      -- source_id (GERS id) intentionally dropped: it was staged but never
      -- promoted to addresses, and at 36 chars/row it was ~31% of the CSV,
      -- the dominant cost of the network-bound copy on big countries.
      row_number() OVER (
        PARTITION BY
          squash(address_levels[len(address_levels)].value),
          squash(street),
          CASE WHEN length(squash(number)) BETWEEN 1 AND ${NUMBER_FIRST_MAX} THEN squash(number) ELSE NULL END,
          CASE WHEN length(squash(unit)) BETWEEN 1 AND ${FLAT_NUMBER_MAX} THEN squash(unit) ELSE NULL END,
          round(ST_X(geometry), 5),
          round(ST_Y(geometry), 5)
      ) AS rn
    FROM read_parquet(
      's3://overturemaps-us-west-2/release/${release}/theme=addresses/type=address/*',
      filename=true, hive_partitioning=1)
    WHERE country = '${country}'
      ${statePredicate}
      AND geometry IS NOT NULL
      AND (number IS NOT NULL OR street IS NOT NULL)
      AND ST_X(geometry) BETWEEN -180 AND 180
      AND ST_Y(geometry) BETWEEN -90 AND 90
  ) WHERE rn = 1
) TO '${outPath}' (FORMAT csv, HEADER false);
`;
}

export function runExtract(
	country: string,
	config: CountryConfig,
	release: string,
	outPath: string,
	stateFilter?: string
): ExtractResult {
	const sql = buildExtractSql(country, config, release, outPath, stateFilter);
	execFileSync("duckdb", ["-c", sql], {
		stdio: ["ignore", "inherit", "inherit"],
	});
	const wc = execFileSync("wc", ["-l", outPath], { encoding: "utf-8" });
	const rowCount = Number.parseInt(
		wc.trim().split(WHITESPACE_RE)[0] ?? "0",
		10
	);
	return { csvPath: outPath, rowCount };
}
