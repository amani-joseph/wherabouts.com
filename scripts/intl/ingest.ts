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
 *   --state <CODE>     Load only one state of a big country (e.g. US CA). The
 *                      load is scoped to (country, state): pre-flight, --replace,
 *                      and post-flight all key on both, so other states of the
 *                      same country are untouched. Used by us-queue.ts.
 *
 * Safety invariants:
 *   - Only ever INSERTs rows for the target country; other countries are
 *     snapshot-checked before/after and the run fails loudly on any drift.
 *   - No index drops. No schema changes.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { runExtract as odaExtract } from "./adapters/oda";
import { runExtract as osmExtract } from "./adapters/osm";
import {
	type ExtractResult,
	runExtract as overtureExtract,
} from "./adapters/overture";
import {
	type CountryConfig,
	getCountryConfig,
	OVERTURE_RELEASE,
} from "./lib/source-registry";

const MANIFEST_PATH = new URL("manifest.json", import.meta.url).pathname;
const HOST_FROM_URL_RE = /.*@([^/:]+).*/;
const WHITESPACE_RE = /\s+/;

interface Args {
	country: string;
	db: string;
	dryRun: boolean;
	keepStaging: boolean;
	release: string;
	replace: boolean;
	state: string;
	useCachedCsv: boolean;
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
		state: (flag("state") ?? "").toUpperCase(),
		keepStaging: has("keep-staging"),
		useCachedCsv: has("use-cached-csv"),
	};
}

function psql(db: string, sql: string): string {
	return execFileSync("psql", [db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], {
		encoding: "utf-8",
	}).trim();
}

// SQL predicate scoping a load to a country (and, for big countries, one
// state). Single-quotes are safe: country/state are validated uppercase codes.
function scopeWhere(country: string, state: string): string {
	const stateClause = state ? ` AND state = '${state}'` : "";
	return `country = '${country}'${stateClause}`;
}

// Scoped count via idx_addresses_country / idx_addresses_state. Full GROUP BY
// snapshots were O(table) and ballooned post-flight time as the table grew;
// promote/DELETE are already scoped to (country[,state]) by construction.
function scopeCount(db: string, country: string, state: string): number {
	return Number(
		psql(
			db,
			`SELECT count(*) FROM addresses WHERE ${scopeWhere(country, state)};`
		)
	);
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
	"number_last,longitude,latitude,confidence";

// Dedup moved into the adapters' extract SQL (DuckDB window function) — the
// Postgres ctid self-join went quadratic past ~6M staged rows.

// The `state` column is written as NULLIF(state, '') so single-level-addressing
// countries land as NULL (not '') — matching the nullable schema. Real codes
// (US/AU/CA) are non-empty and pass through unchanged. Existing rows are not
// rewritten; only future loads are affected. See docs/migrations/2026-06-20-state-nullable.
// search_text mirrors drizzle/0004_autocomplete_search.sql, with NULLIF on
// empty strings so single-level countries don't get double spaces
// (Iceland smoke-test finding #1).
const PROMOTE_SQL = `
INSERT INTO addresses
 (country, state, locality, postcode, street_name, street_type, street_suffix,
  building_name, flat_type, flat_number, level_type, level_number,
  number_first, number_last, longitude, latitude, confidence, gnaf_pid,
  search_text, geom, population_score, admin_level)
SELECT country, NULLIF(state, ''), locality, postcode, street_name, street_type, street_suffix,
  building_name, flat_type, flat_number, level_type, level_number,
  number_first, number_last, longitude, latitude, confidence, NULL,
  trim(concat_ws(' ',
    NULLIF(number_first, ''), NULLIF(number_last, ''), NULLIF(street_name, ''),
    street_type, street_suffix, building_name,
    NULLIF(locality, ''), NULLIF(state, ''), NULLIF(postcode, ''), country)),
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
  0, 5
FROM addresses_staging;`;

async function extract(
	country: string,
	config: CountryConfig,
	release: string,
	csvPath: string,
	state: string
): Promise<ExtractResult> {
	if (config.adapter === "overture") {
		return overtureExtract(
			country,
			config,
			release,
			csvPath,
			state || undefined
		);
	}
	if (config.adapter === "oda") {
		return await odaExtract(csvPath);
	}
	if (config.adapter === "osm") {
		return osmExtract(country, config, csvPath);
	}
	throw new Error(`adapter "${config.adapter}" not implemented yet`);
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const config = getCountryConfig(args.country);
	const scopeTag = args.state
		? `${args.country.toLowerCase()}-${args.state.toLowerCase()}`
		: args.country.toLowerCase();
	const csvPath = `/tmp/${config.adapter}-${scopeTag}.csv`;
	const label = args.state ? `${args.country}/${args.state}` : args.country;

	console.log(
		`country=${args.country}${args.state ? ` state=${args.state}` : ""} adapter=${config.adapter} release=${args.release}`
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

	// Pre-flight: refuse silent re-ingest
	const existing = scopeCount(args.db, args.country, args.state);
	if (existing > 0 && !args.replace) {
		throw new Error(
			`${label} already has ${existing} rows. Re-run with --replace to delete+reload.`
		);
	}

	// Extract (or reuse a prefetched CSV — see prefetch.ts)
	let rowCount: number;
	if (args.useCachedCsv && existsSync(csvPath)) {
		const wc = execFileSync("wc", ["-l", csvPath], { encoding: "utf-8" });
		rowCount = Number.parseInt(wc.trim().split(WHITESPACE_RE)[0] ?? "0", 10);
		console.log(`using prefetched CSV: ${rowCount} rows at ${csvPath}`);
		if (rowCount === 0) {
			throw new Error(`cached CSV ${csvPath} is empty — delete it and re-run`);
		}
	} else {
		console.log(`extracting via ${config.adapter} adapter…`);
		({ rowCount } = await extract(
			args.country,
			config,
			args.release,
			csvPath,
			args.state
		));
		console.log(`extracted ${rowCount} rows -> ${csvPath}`);
	}

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
	const staged = Number(
		psql(args.db, "SELECT count(*) FROM addresses_staging;")
	);
	console.log(`staged ${staged} rows (deduped at extract)`);

	// Promote (with optional replace) — single transaction. DELETE is scoped to
	// (country[,state]) so re-loading one US state never touches the others.
	const replaceSql = args.replace
		? `DELETE FROM addresses WHERE ${scopeWhere(args.country, args.state)};`
		: "";
	psql(args.db, `BEGIN; ${replaceSql} ${PROMOTE_SQL} COMMIT;`);

	// Post-flight: one indexed pass — scoped total + null geoms together. The
	// promote INSERT and optional DELETE are both scoped to (country[,state]),
	// so rows outside this scope cannot change by construction.
	const out = psql(
		args.db,
		`SELECT count(*) || '|' || count(*) FILTER (WHERE geom IS NULL)
		 FROM addresses WHERE ${scopeWhere(args.country, args.state)};`
	);
	const [promoted, nullGeoms] = out.split("|").map(Number);
	console.log(`promoted: ${promoted} rows (${nullGeoms} null geoms)`);
	if ((nullGeoms ?? 0) > 0) {
		throw new Error("null geoms detected after promote");
	}
	if ((promoted ?? 0) < staged) {
		throw new Error(
			`promoted ${promoted} < staged ${staged} — promote incomplete?`
		);
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
		state: args.state || undefined,
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

await main();
