/**
 * International address ingestion orchestrator (pipeline spec §3–§6, §9).
 *
 * Usage:
 *   bun scripts/intl/ingest.ts <COUNTRY> --db <postgres-url | @file-with-url> [options]
 *
 * Options:
 *   --db <url|@file>   REQUIRED. Target Postgres. Never read from .env on purpose:
 *                      writing to a database is always an explicit, approved act.
 *   --release <tag>    Override pinned Overture release.
 *   --dry-run          Print the plan + extract SQL, touch nothing.
 *   --replace          DELETE existing rows for the country before promote (destructive;
 *                      refused unless given).
 *   --keep-staging     Keep addresses_staging after promote (default: drop).
 *
 * Safety invariants:
 *   - Only ever INSERTs rows for the target country; other countries are
 *     snapshot-checked before/after and the run fails loudly on any drift.
 *   - No index drops. No schema changes.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { runExtract } from "./adapters/overture";
import { getCountryConfig, OVERTURE_RELEASE } from "./lib/source-registry";

const MANIFEST_PATH = new URL("manifest.json", import.meta.url).pathname;
const HOST_FROM_URL_RE = /.*@([^/:]+).*/;

interface Args {
	country: string;
	db: string;
	dryRun: boolean;
	keepStaging: boolean;
	release: string;
	replace: boolean;
}

function parseArgs(argv: string[]): Args {
	const [country] = argv.filter((a) => !a.startsWith("--"));
	if (!country) {
		throw new Error("Usage: ingest.ts <COUNTRY> --db <url|@file> [--dry-run]");
	}
	const flag = (name: string): string | undefined => {
		const i = argv.indexOf(`--${name}`);
		return i >= 0 ? argv[i + 1] : undefined;
	};
	const has = (name: string): boolean => argv.includes(`--${name}`);

	let db = flag("db") ?? "";
	if (db.startsWith("@")) {
		db = readFileSync(db.slice(1), "utf-8").trim();
	}
	if (!(db || has("dry-run"))) {
		throw new Error(
			"--db is required (connection string, or @path to a file containing one). " +
				"This script never reads DATABASE_URL from .env: pointing it at a database " +
				"is an explicit, approved decision."
		);
	}
	return {
		country: country.toUpperCase(),
		db,
		release: flag("release") ?? OVERTURE_RELEASE,
		dryRun: has("dry-run"),
		replace: has("replace"),
		keepStaging: has("keep-staging"),
	};
}

function psql(db: string, sql: string): string {
	return execFileSync("psql", [db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], {
		encoding: "utf-8",
	}).trim();
}

function countsByCountry(db: string): Map<string, number> {
	const out = psql(
		db,
		"SELECT country, count(*) FROM addresses GROUP BY country;"
	);
	const map = new Map<string, number>();
	for (const line of out.split("\n").filter(Boolean)) {
		const [c, n] = line.split("|");
		map.set(c, Number(n));
	}
	return map;
}

const STAGING_DDL = `
CREATE UNLOGGED TABLE IF NOT EXISTS addresses_staging (
  source text NOT NULL,
  country varchar(2) NOT NULL,
  state varchar(10) NOT NULL DEFAULT '',
  locality text NOT NULL DEFAULT '',
  postcode varchar(10) NOT NULL DEFAULT '',
  street_name text NOT NULL DEFAULT '',
  street_type varchar(20), street_suffix varchar(10), building_name text,
  flat_type varchar(10), flat_number varchar(10),
  level_type varchar(10), level_number varchar(10),
  number_first varchar(15), number_last varchar(15),
  longitude real NOT NULL, latitude real NOT NULL,
  confidence integer, source_id text
);
TRUNCATE addresses_staging;`;

const STAGING_COLUMNS =
	"source,country,state,locality,postcode,street_name,street_type,street_suffix," +
	"building_name,flat_type,flat_number,level_type,level_number,number_first," +
	"number_last,longitude,latitude,confidence,source_id";

const DEDUP_SQL = `
DELETE FROM addresses_staging a USING addresses_staging b
WHERE a.ctid < b.ctid
  AND a.country = b.country AND a.locality = b.locality
  AND a.street_name = b.street_name
  AND a.number_first IS NOT DISTINCT FROM b.number_first
  AND a.flat_number IS NOT DISTINCT FROM b.flat_number
  AND round(a.latitude::numeric, 5) = round(b.latitude::numeric, 5)
  AND round(a.longitude::numeric, 5) = round(b.longitude::numeric, 5);`;

// search_text mirrors drizzle/0004_autocomplete_search.sql, with NULLIF on
// empty strings so single-level countries (state='') don't get double spaces
// (Iceland smoke-test finding #1).
const PROMOTE_SQL = `
INSERT INTO addresses
 (country, state, locality, postcode, street_name, street_type, street_suffix,
  building_name, flat_type, flat_number, level_type, level_number,
  number_first, number_last, longitude, latitude, confidence, gnaf_pid,
  search_text, geom, population_score, admin_level)
SELECT country, state, locality, postcode, street_name, street_type, street_suffix,
  building_name, flat_type, flat_number, level_type, level_number,
  number_first, number_last, longitude, latitude, confidence, NULL,
  trim(concat_ws(' ',
    NULLIF(number_first, ''), NULLIF(number_last, ''), NULLIF(street_name, ''),
    street_type, street_suffix, building_name,
    NULLIF(locality, ''), NULLIF(state, ''), NULLIF(postcode, ''), country)),
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
  0, 5
FROM addresses_staging;`;

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const config = getCountryConfig(args.country);
	const csvPath = `/tmp/overture-${args.country.toLowerCase()}.csv`;

	console.log(
		`country=${args.country} adapter=${config.adapter} release=${args.release}`
	);
	if (args.dryRun) {
		console.log(
			"[dry-run] would extract to",
			csvPath,
			"then stage/dedup/promote."
		);
		return;
	}

	const host = args.db.replace(HOST_FROM_URL_RE, "$1");
	console.log(`target host: ${host}`);

	// Pre-flight: snapshot + refuse silent re-ingest
	const before = countsByCountry(args.db);
	const existing = before.get(args.country) ?? 0;
	if (existing > 0 && !args.replace) {
		throw new Error(
			`${args.country} already has ${existing} rows. Re-run with --replace to delete+reload.`
		);
	}

	// Extract
	console.log("extracting from Overture…");
	const { rowCount } = runExtract(args.country, config, args.release, csvPath);
	console.log(`extracted ${rowCount} rows -> ${csvPath}`);

	// Stage
	psql(args.db, STAGING_DDL);
	execFileSync(
		"psql",
		[
			args.db,
			"-v",
			"ON_ERROR_STOP=1",
			"-c",
			`\\copy addresses_staging (${STAGING_COLUMNS}) FROM '${csvPath}' WITH (FORMAT csv)`,
		],
		{ stdio: ["ignore", "inherit", "inherit"] }
	);
	psql(args.db, DEDUP_SQL);
	const staged = Number(
		psql(args.db, "SELECT count(*) FROM addresses_staging;")
	);
	console.log(`staged ${staged} rows after dedup`);

	// Promote (with optional replace) — single transaction
	const replaceSql = args.replace
		? `DELETE FROM addresses WHERE country = '${args.country}';`
		: "";
	psql(args.db, `BEGIN; ${replaceSql} ${PROMOTE_SQL} COMMIT;`);

	// Post-flight: only the target country may have changed
	const after = countsByCountry(args.db);
	for (const [c, n] of before) {
		if (c !== args.country && after.get(c) !== n) {
			throw new Error(
				`INVARIANT VIOLATED: country ${c} changed ${n} -> ${after.get(c)}`
			);
		}
	}
	const promoted = after.get(args.country) ?? 0;
	const nullGeoms = Number(
		psql(
			args.db,
			`SELECT count(*) FROM addresses WHERE country='${args.country}' AND geom IS NULL;`
		)
	);
	console.log(`promoted: ${promoted} rows (${nullGeoms} null geoms)`);
	if (nullGeoms > 0) {
		throw new Error("null geoms detected after promote");
	}

	if (!args.keepStaging) {
		psql(args.db, "DROP TABLE addresses_staging;");
		rmSync(csvPath, { force: true }); // disk hygiene — big-country CSVs add up
	}

	// Manifest
	const manifest = existsSync(MANIFEST_PATH)
		? JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"))
		: [];
	manifest.push({
		country: args.country,
		adapter: config.adapter,
		release: args.release,
		extracted: rowCount,
		staged,
		promoted,
		targetHost: host,
		finishedAt: new Date().toISOString(),
	});
	writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
	console.log("done — manifest updated");
}

main();
