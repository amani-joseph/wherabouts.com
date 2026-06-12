/**
 * Sequential country rollout runner (pipeline spec §5, Europe campaign).
 *
 * Usage:
 *   bun scripts/intl/run-queue.ts --db <url|@file> [--countries CC,CC,...]
 *
 * - Loads each registered country via ingest.ts, smallest-first by default.
 * - Skips countries that already have rows (safe to re-run after a failure).
 * - Stops on first failure; progress is in ingest.ts's manifest.json.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { COUNTRIES } from "./lib/source-registry";

/** Smallest-first default queue; only Overture-adapter countries. */
const DEFAULT_ORDER = [
	"FO",
	"LI",
	"LU",
	"IS",
	"LV",
	"SI",
	"LT",
	"HR",
	"SK",
	"EE",
	"AT",
	"RS",
	"CZ",
	"CH",
	"NO",
	"FI",
	"DK",
	"PT",
	"BE",
	"PL",
	"NL",
	"ES",
	"DE",
	"IT",
	"FR",
];

function parseArgs(argv: string[]): { db: string; countries: string[] } {
	const flag = (name: string): string | undefined => {
		const i = argv.indexOf(`--${name}`);
		return i >= 0 ? argv[i + 1] : undefined;
	};
	let db = flag("db") ?? "";
	if (db.startsWith("@")) {
		db = readFileSync(db.slice(1), "utf-8").trim();
	}
	if (!db) {
		throw new Error("--db is required (url or @file)");
	}
	const countries = (flag("countries")?.split(",") ?? DEFAULT_ORDER)
		.map((c) => c.trim().toUpperCase())
		.filter((c) => COUNTRIES[c]?.adapter === "overture");
	return { db, countries };
}

function loadedCountries(db: string): Set<string> {
	const out = execFileSync(
		"psql",
		[
			db,
			"-v",
			"ON_ERROR_STOP=1",
			"-tAc",
			"SELECT DISTINCT country FROM addresses;",
		],
		{ encoding: "utf-8" }
	);
	return new Set(out.split("\n").filter(Boolean));
}

function main(): void {
	const { db, countries } = parseArgs(process.argv.slice(2));
	const done = loadedCountries(db);

	const queue = countries.filter((c) => !done.has(c));
	const skipped = countries.filter((c) => done.has(c));
	if (skipped.length > 0) {
		console.log(`skipping (already loaded): ${skipped.join(", ")}`);
	}
	console.log(`queue (${queue.length}): ${queue.join(", ")}`);

	for (const country of queue) {
		const startedAt = Date.now();
		console.log(`\n===== ${country} =====`);
		const result = spawnSync(
			"bun",
			[new URL("ingest.ts", import.meta.url).pathname, country, "--db", db],
			{ stdio: "inherit" }
		);
		if (result.status !== 0) {
			throw new Error(
				`${country} failed (exit ${result.status}) — queue stopped; re-run to resume`
			);
		}
		const mins = ((Date.now() - startedAt) / 60_000).toFixed(1);
		console.log(`===== ${country} done in ${mins} min =====`);
	}
	console.log("\nqueue complete");
}

main();
