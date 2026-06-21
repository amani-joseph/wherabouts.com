/**
 * OpenStreetMap adapter — for countries with no usable Overture/NAD/ODA address
 * coverage (notably GB: Overture has 0 GB rows, and PAF/AddressBase are
 * commercial). Source of record is the per-country Geofabrik extract.
 *
 * License: OSM data is ODbL (attribution + share-alike). Promoted GB rows are an
 * ODbL-affected derived database — keep "© OpenStreetMap contributors" attribution
 * wherever the corpus is exposed. See docs/proposals/uk-address-data-plan.md.
 *
 * Pipeline (validated 2026-06-22 on a central-London bbox):
 *   1. download the Geofabrik .osm.pbf (cached in /tmp/osm)
 *   2. osmium tags-filter nwr/addr:housenumber  -> small pbf of addressed objects
 *   3. osmium export -> GeoJSON Text Sequence (one feature per object; ways/areas
 *      keep their polygon/linestring geometry)
 *   4. strip the RFC 8142 record-separator byte (0x1E) that DuckDB's JSON reader
 *      rejects -> newline-delimited JSON
 *   5. one DuckDB pass: ST_Centroid each geometry to a point, pull addr:* tags,
 *      dedup with the same window function the other adapters use, write the
 *      canonical staging CSV.
 *
 * Sizing (osmium on the GB+NI extract, 2026-06-22): ~24.7M objects carry
 * addr:housenumber (20.35M nodes + 4.34M ways). Realistic distinct rows after
 * centroid+dedup ~15-20M.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import type { CountryConfig } from "../lib/source-registry";
import type { ExtractResult } from "./overture";

const WORK_DIR = "/tmp/osm";
const WHITESPACE_RE = /\s+/;
const COORD_PRECISION = 7;
const FLAT_NUMBER_MAX = 10;
const NUMBER_FIRST_MAX = 15;

// Per-country Geofabrik download. The UK extract is by geography and covers
// Great Britain + Northern Ireland (not the Isle of Man or Channel Islands);
// every object in it is UK, so we tag the whole extract country='GB'.
const GEOFABRIK_URL: Record<string, string> = {
	GB: "https://download.geofabrik.de/europe/united-kingdom-latest.osm.pbf",
};

// addr:* tags kept in the export. Trimming to these keeps the GeoJSON small
// (the full tag set on 24.7M objects is otherwise the dominant cost).
const INCLUDE_TAGS = [
	"addr:housenumber",
	"addr:street",
	"addr:city",
	"addr:town",
	"addr:suburb",
	"addr:place",
	"addr:postcode",
	"addr:housename",
	"addr:unit",
];

export function geofabrikUrl(country: string): string {
	const url = GEOFABRIK_URL[country];
	if (!url) {
		throw new Error(
			`No Geofabrik URL registered for ${country} in the osm adapter. ` +
				"Add one to GEOFABRIK_URL."
		);
	}
	return url;
}

/**
 * DuckDB SQL that shapes the newline-delimited GeoJSON into the canonical
 * staging CSV. Pure (no I/O) so it can be inspected/tested in isolation, mirroring
 * overture.buildExtractSql. `state` is always '' — OSM addr objects have no clean
 * region and GB is single-level-addressing (promotes to NULL, like the European
 * countries).
 */
export function buildShapeSql(
	country: string,
	ndjsonPath: string,
	outPath: string
): string {
	const locality =
		"COALESCE(p->>'addr:city', p->>'addr:town', p->>'addr:suburb', p->>'addr:place')";
	const number = `CASE WHEN length(squash(p->>'addr:housenumber')) BETWEEN 1 AND ${NUMBER_FIRST_MAX} THEN squash(p->>'addr:housenumber') END`;
	const unit = `CASE WHEN length(squash(p->>'addr:unit')) BETWEEN 1 AND ${FLAT_NUMBER_MAX} THEN squash(p->>'addr:unit') END`;
	return `
LOAD spatial;
-- squash: trim + collapse internal whitespace (matches overture/oda adapters)
CREATE OR REPLACE MACRO squash(x) AS COALESCE(trim(regexp_replace(x, '\\s+', ' ', 'g')), '');
COPY (
  -- Dedup HERE via window function (O(n log n)); the former Postgres-side
  -- ctid self-join went quadratic past ~6M rows. PARTITION BY treats NULLs equal.
  SELECT * EXCLUDE (rn) FROM (
    SELECT
      'OSM' AS source,
      '${country}' AS country,
      '' AS state,
      squash(${locality}) AS locality,
      CASE WHEN length(squash(p->>'addr:postcode')) <= 10 THEN squash(p->>'addr:postcode') ELSE '' END AS postcode,
      squash(p->>'addr:street') AS street_name,
      NULL AS street_type, NULL AS street_suffix,
      NULLIF(squash(p->>'addr:housename'), '') AS building_name,
      NULL AS flat_type,
      ${unit} AS flat_number,
      NULL AS level_type, NULL AS level_number,
      ${number} AS number_first,
      NULL AS number_last,
      round(ST_X(ST_Centroid(g)), ${COORD_PRECISION}) AS longitude,
      round(ST_Y(ST_Centroid(g)), ${COORD_PRECISION}) AS latitude,
      NULL AS confidence,
      row_number() OVER (
        PARTITION BY
          squash(${locality}), squash(p->>'addr:street'),
          ${number}, ${unit},
          round(ST_X(ST_Centroid(g)), 5), round(ST_Y(ST_Centroid(g)), 5)
      ) AS rn
    FROM (
      SELECT ST_GeomFromGeoJSON(geometry::VARCHAR) AS g, properties::JSON AS p
      FROM read_json('${ndjsonPath}', format='newline_delimited',
                     columns={'type':'VARCHAR','geometry':'JSON','properties':'JSON'})
    )
    WHERE g IS NOT NULL
      AND ST_X(ST_Centroid(g)) BETWEEN -180 AND 180
      AND ST_Y(ST_Centroid(g)) BETWEEN -90 AND 90
      AND (squash(p->>'addr:housenumber') <> '' OR squash(p->>'addr:street') <> '')
  ) WHERE rn = 1
) TO '${outPath}' (FORMAT csv, HEADER false);
`;
}

function ensurePbf(country: string): string {
	mkdirSync(WORK_DIR, { recursive: true });
	const url = geofabrikUrl(country);
	const fileName = url.split("/").pop() ?? `${country}.osm.pbf`;
	const pbfPath = `${WORK_DIR}/${fileName}`;
	if (existsSync(pbfPath)) {
		console.log(`  using cached PBF: ${pbfPath}`);
		return pbfPath;
	}
	throw new Error(
		`PBF not found at ${pbfPath}. Download it first (it's ~2GB; we don't ` +
			`fetch it implicitly):\n  curl -L -o ${pbfPath} ${url}\n` +
			"(run that yourself with `! curl …`, or prefetch into /tmp/osm)."
	);
}

export function runExtract(
	country: string,
	_config: CountryConfig,
	outPath: string
): ExtractResult {
	const pbfPath = ensurePbf(country);
	const addrPbf = `${WORK_DIR}/${country}-addr.osm.pbf`;
	const seqPath = `${WORK_DIR}/${country}.geojsonseq`;
	const ndjsonPath = `${WORK_DIR}/${country}.ndjson`;
	const configPath = `${WORK_DIR}/${country}-export.json`;

	console.log("  osmium tags-filter (addr:housenumber)…");
	execFileSync(
		"osmium",
		[
			"tags-filter",
			pbfPath,
			"nwr/addr:housenumber",
			"-o",
			addrPbf,
			"--overwrite",
		],
		{ stdio: ["ignore", "inherit", "inherit"] }
	);

	writeFileSync(
		configPath,
		JSON.stringify({
			include_tags: INCLUDE_TAGS,
			geometry_types: ["point", "linestring", "polygon"],
		})
	);
	console.log("  osmium export -> geojsonseq…");
	execFileSync(
		"osmium",
		[
			"export",
			addrPbf,
			"-c",
			configPath,
			"-f",
			"geojsonseq",
			"-o",
			seqPath,
			"--overwrite",
		],
		{ stdio: ["ignore", "inherit", "inherit"] }
	);

	// Strip the RFC 8142 record-separator (0x1E) osmium prefixes each record with;
	// DuckDB's newline-delimited JSON reader rejects it. Paths are adapter-derived.
	console.log("  strip record separators…");
	execFileSync("sh", ["-c", `tr -d '\\036' < '${seqPath}' > '${ndjsonPath}'`], {
		stdio: ["ignore", "inherit", "inherit"],
	});

	console.log("  duckdb shape -> staging CSV…");
	execFileSync("duckdb", ["-c", buildShapeSql(country, ndjsonPath, outPath)], {
		stdio: ["ignore", "inherit", "inherit"],
	});

	const wc = execFileSync("wc", ["-l", outPath], { encoding: "utf-8" });
	const rowCount = Number.parseInt(
		wc.trim().split(WHITESPACE_RE)[0] ?? "0",
		10
	);
	return { csvPath: outPath, rowCount };
}
