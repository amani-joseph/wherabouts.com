/**
 * Ordnance Survey OpenData adapter (GB coverage backstop, Phase 2) — gives
 * nationwide postcode + street + place geocoding where OSM has no premise
 * (the osm adapter, Phase 1, supplies house-number-level addresses).
 *
 * Two free OGL products, pulled key-free from the OS Downloads API:
 *   - Code-Point Open  (codepo_gb.zip, ~14MB)  -> ~1.7M postcode-unit centroids
 *   - OS Open Names    (opname_csv_gb.zip,~103MB) -> roads + populated places
 *
 * Both ship British National Grid eastings/northings (EPSG:27700); we reproject
 * to WGS84 (EPSG:4326) in DuckDB (ST_Transform … always_xy). GB only — these
 * products do not cover Northern Ireland (NI premise coords come from OSM).
 *
 * License: Open Government Licence — keep "Contains OS data © Crown copyright and
 * database right 2026" attribution. See docs/proposals/uk-address-data-plan.md.
 *
 * Output rows carry no house number (number_first NULL) and tag their origin in
 * the staging `source` column ('OS_CODEPOINT' / 'OS_OPENNAMES').
 *
 * LOADING IS UNRESOLVED (see docs/proposals/uk-address-data-plan.md, Phase 2):
 * `addresses` has no `source` column — staging `source` is dropped on promote —
 * and ingest.ts is one-adapter-per-country with a country-wide --replace, so OS
 * coverage rows cannot be appended/refreshed without also wiping the osm GB rows.
 * Resolving that (add a `source` column, or distinguish via admin_level, or load
 * differently) is a pending decision; this module only produces the staging CSV.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import type { ExtractResult } from "./overture";

const WORK_DIR = "/tmp/osopen";
const WHITESPACE_RE = /\s+/;
const COORD_PRECISION = 7;

interface OsProduct {
	/** glob (relative to the product's unzip dir) of the CSV data files */
	glob: string;
	subdir: string;
	url: string;
	zip: string;
}

const PRODUCTS: Record<"codepoint" | "opennames", OsProduct> = {
	codepoint: {
		url: "https://api.os.uk/downloads/v1/products/CodePointOpen/downloads?area=GB&format=CSV&redirect",
		zip: "codepo_gb.zip",
		subdir: "codepo",
		glob: "Data/CSV/*.csv",
	},
	opennames: {
		url: "https://api.os.uk/downloads/v1/products/OpenNames/downloads?area=GB&format=CSV&redirect",
		zip: "opname_csv_gb.zip",
		subdir: "opname",
		glob: "Data/*.csv",
	},
};

// read_csv names: both files are header-less and positional. DuckDB's default
// columnNN names are zero-padded to the file's column count (column0..column9 vs
// column00..column33), which is brittle; pin explicit names instead.
function names(count: number): string {
	return `[${Array.from({ length: count }, (_, i) => `'c${i}'`).join(",")}]`;
}

// EPSG:27700 (British National Grid) easting/northing -> WGS84 lon/lat.
const REPROJECT_MACROS = `
CREATE OR REPLACE MACRO bng_lon(e, n) AS
  round(ST_X(ST_Transform(ST_Point(e, n), 'EPSG:27700', 'EPSG:4326', always_xy := true)), ${COORD_PRECISION});
CREATE OR REPLACE MACRO bng_lat(e, n) AS
  round(ST_Y(ST_Transform(ST_Point(e, n), 'EPSG:27700', 'EPSG:4326', always_xy := true)), ${COORD_PRECISION});`;

/**
 * DuckDB SQL shaping Code-Point + Open Names into the canonical staging CSV.
 * Pure (no I/O) for inspection/testing, like overture.buildExtractSql.
 *
 * Column maps (0-indexed, header-less):
 *   Code-Point (10): postcode=c0, easting=c2, northing=c3
 *   Open Names (34): NAME1=c2, TYPE=c6, LOCAL_TYPE=c7, X=c8, Y=c9,
 *                    POSTCODE_DISTRICT=c16, POPULATED_PLACE=c18,
 *                    DISTRICT_BOROUGH=c21, COUNTY_UNITARY=c24
 */
export function buildShapeSql(
	cpGlob: string,
	onGlob: string,
	outPath: string
): string {
	const cpRead = `read_csv('${cpGlob}', header=false, all_varchar=true, names=${names(10)})`;
	const onRead = `read_csv('${onGlob}', header=false, all_varchar=true, names=${names(34)})`;
	// Plausible BNG bounds — guards against malformed easting/northing.
	const cpValid =
		"TRY_CAST(c2 AS DOUBLE) BETWEEN 0 AND 700000 AND TRY_CAST(c3 AS DOUBLE) BETWEEN 0 AND 1300000";
	const onValid =
		"TRY_CAST(c8 AS DOUBLE) BETWEEN 0 AND 700000 AND TRY_CAST(c9 AS DOUBLE) BETWEEN 0 AND 1300000";
	const onLocality =
		"squash(COALESCE(NULLIF(c18, ''), NULLIF(c21, ''), NULLIF(c24, '')))";
	const pcDistrict =
		"CASE WHEN length(squash(c16)) <= 10 THEN squash(upper(c16)) ELSE '' END";
	// 18 staging columns, in order. All OS rows: state '', no street_type/suffix/
	// building/flat/level, no number.
	const cols = (
		source: string,
		locality: string,
		postcode: string,
		street: string,
		eCol: string,
		nCol: string
	): string => `
      '${source}' AS source, 'GB' AS country, '' AS state,
      ${locality} AS locality, ${postcode} AS postcode, ${street} AS street_name,
      NULL AS street_type, NULL AS street_suffix, NULL AS building_name,
      NULL AS flat_type, NULL AS flat_number, NULL AS level_type, NULL AS level_number,
      NULL AS number_first, NULL AS number_last,
      bng_lon(TRY_CAST(${eCol} AS DOUBLE), TRY_CAST(${nCol} AS DOUBLE)) AS longitude,
      bng_lat(TRY_CAST(${eCol} AS DOUBLE), TRY_CAST(${nCol} AS DOUBLE)) AS latitude,
      NULL AS confidence`;
	return `
LOAD spatial;
CREATE OR REPLACE MACRO squash(x) AS COALESCE(trim(regexp_replace(x, '\\s+', ' ', 'g')), '');
${REPROJECT_MACROS}
COPY (
  SELECT * EXCLUDE (rn) FROM (
    SELECT *, row_number() OVER (
      PARTITION BY source, postcode, street_name, locality,
        round(longitude, 5), round(latitude, 5)
    ) AS rn
    FROM (
      -- Code-Point Open -> postcode-unit centroids
      SELECT ${cols("OS_CODEPOINT", "''", "CASE WHEN length(squash(c0)) <= 10 THEN squash(upper(c0)) ELSE '' END", "''", "c2", "c3")}
      FROM ${cpRead} WHERE ${cpValid}
      UNION ALL
      -- OS Open Names roads -> street-level rows
      SELECT ${cols("OS_OPENNAMES", onLocality, pcDistrict, "squash(c2)", "c8", "c9")}
      FROM ${onRead} WHERE c6 = 'transportNetwork' AND ${onValid}
      UNION ALL
      -- OS Open Names populated places -> locality-level rows
      SELECT ${cols("OS_OPENNAMES", "squash(c2)", pcDistrict, "''", "c8", "c9")}
      FROM ${onRead} WHERE c6 = 'populatedPlace' AND ${onValid}
    )
  ) WHERE rn = 1
) TO '${outPath}' (FORMAT csv, HEADER false);
`;
}

async function ensureDownloaded(product: OsProduct): Promise<string> {
	mkdirSync(WORK_DIR, { recursive: true });
	const zipPath = `${WORK_DIR}/${product.zip}`;
	const outDir = `${WORK_DIR}/${product.subdir}`;
	if (!existsSync(zipPath)) {
		console.log(`  downloading ${product.zip}…`);
		const res = await fetch(product.url);
		if (!res.ok) {
			throw new Error(`${product.zip} download failed: HTTP ${res.status}`);
		}
		writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
	}
	mkdirSync(outDir, { recursive: true });
	execFileSync("unzip", ["-o", "-q", zipPath, "-d", outDir]);
	return `${outDir}/${product.glob}`;
}

export async function runExtract(outPath: string): Promise<ExtractResult> {
	const cpGlob = await ensureDownloaded(PRODUCTS.codepoint);
	const onGlob = await ensureDownloaded(PRODUCTS.opennames);
	console.log("  duckdb shape (Code-Point + Open Names) -> staging CSV…");
	execFileSync("duckdb", ["-c", buildShapeSql(cpGlob, onGlob, outPath)], {
		stdio: ["ignore", "inherit", "inherit"],
	});
	const wc = execFileSync("wc", ["-l", outPath], { encoding: "utf-8" });
	const rowCount = Number.parseInt(
		wc.trim().split(WHITESPACE_RE)[0] ?? "0",
		10
	);
	return { csvPath: outPath, rowCount };
}
