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
	outPath: string
): string {
	const stateExpr =
		config.state === "none" ? "''" : "squash(address_levels[1].value)"; // mapped to codes by the orchestrator post-pass
	return `
-- squash: trim + collapse internal whitespace (source data sometimes has doubles)
CREATE OR REPLACE MACRO squash(x) AS COALESCE(trim(regexp_replace(x, '\\s+', ' ', 'g')), '');
LOAD spatial; LOAD httpfs; SET s3_region='us-west-2';
COPY (
  SELECT
    'OVERTURE' AS source,
    '${country}' AS country,
    ${stateExpr} AS state,
    squash(address_levels[len(address_levels)].value) AS locality,
    squash(postcode) AS postcode,
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
    id AS source_id
  FROM read_parquet(
    's3://overturemaps-us-west-2/release/${release}/theme=addresses/type=address/*',
    filename=true, hive_partitioning=1)
  WHERE country = '${country}'
    AND geometry IS NOT NULL
    AND (number IS NOT NULL OR street IS NOT NULL)
    AND ST_X(geometry) BETWEEN -180 AND 180
    AND ST_Y(geometry) BETWEEN -90 AND 90
) TO '${outPath}' (FORMAT csv, HEADER false);
`;
}

export function runExtract(
	country: string,
	config: CountryConfig,
	release: string,
	outPath: string
): ExtractResult {
	const sql = buildExtractSql(country, config, release, outPath);
	execFileSync("duckdb", ["-c", sql], {
		stdio: ["ignore", "inherit", "inherit"],
	});
	const wc = execFileSync("wc", ["-l", outPath], { encoding: "utf-8" });
	const rowCount = Number.parseInt(wc.trim().split(WHITESPACE_RE)[0] ?? "0", 10);
	return { csvPath: outPath, rowCount };
}
