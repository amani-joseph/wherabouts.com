/**
 * US state-by-state rollout runner. US is 126.5M rows — far too large for one
 * COPY on the local→Neon uplink (would be 13+ hours and one fragile transaction).
 * Loading per state makes each chunk European-sized (~0.03–14M rows) and
 * resumable: a failure costs one state, not the whole country.
 *
 * Usage:
 *   bun scripts/intl/us-queue.ts --db <url|@file> [--states CA,TX,...]
 *
 * - Smallest-first by default (fail fast on cheap states before the giants).
 * - Skips states already present in addresses (safe to re-run after a failure).
 * - Retries transient drops 3x with 60s backoff; detects committed-but-ack-lost
 *   by re-checking the state's row count.
 * - Extracts are serialized (no prefetch): on the near-full local disk, two
 *   concurrent DuckDB extracts can exhaust temp space (campaign lesson).
 */

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// 50 states + DC + VI, smallest-first (Overture 2026-05-20.0 counts).
const STATE_ORDER = [
	"VI",
	"NV",
	"SD",
	"SC",
	"WY",
	"LA",
	"AK",
	"VT",
	"ID",
	"RI",
	"DC",
	"ND",
	"DE",
	"GA",
	"MT",
	"ME",
	"NE",
	"MI",
	"KS",
	"WV",
	"NM",
	"PA",
	"CT",
	"MS",
	"UT",
	"OK",
	"WI",
	"IA",
	"MO",
	"AR",
	"MN",
	"KY",
	"MD",
	"CO",
	"AL",
	"WA",
	"IN",
	"MA",
	"AZ",
	"NJ",
	"VA",
	"OR",
	"TN",
	"IL",
	"OH",
	"NC",
	"NY",
	"TX",
	"FL",
	"CA",
];

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 60_000;
const INGEST_PATH = new URL("ingest.ts", import.meta.url).pathname;

function parseArgs(argv: string[]): { db: string; states: string[] } {
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
	const states = (flag("states")?.split(",") ?? STATE_ORDER).map((s) =>
		s.trim().toUpperCase()
	);
	return { db, states };
}

/** States already loaded (distinct state where country='US'). */
function loadedStates(db: string): Set<string> {
	const out = execFileSync(
		"psql",
		[
			db,
			"-v",
			"ON_ERROR_STOP=1",
			"-tAc",
			"SELECT DISTINCT state FROM addresses WHERE country='US';",
		],
		{ encoding: "utf-8" }
	);
	return new Set(out.split("\n").filter(Boolean));
}

function stateRowCount(db: string, state: string): number {
	const out = execFileSync(
		"psql",
		[
			db,
			"-v",
			"ON_ERROR_STOP=1",
			"-tAc",
			`SELECT count(*) FROM addresses WHERE country='US' AND state='${state}';`,
		],
		{ encoding: "utf-8" }
	);
	return Number(out.trim());
}

function main(): void {
	const { db, states } = parseArgs(process.argv.slice(2));
	const done = loadedStates(db);

	const queue = states.filter((s) => !done.has(s));
	const skipped = states.filter((s) => done.has(s));
	if (skipped.length > 0) {
		console.log(`skipping (already loaded): ${skipped.join(", ")}`);
	}
	console.log(`US queue (${queue.length}): ${queue.join(", ")}`);

	for (const state of queue) {
		const startedAt = Date.now();
		console.log(`\n===== US/${state} =====`);

		let succeeded = false;
		for (let attempt = 1; attempt <= MAX_ATTEMPTS && !succeeded; attempt++) {
			if (attempt > 1) {
				console.log(`retry ${attempt}/${MAX_ATTEMPTS} for US/${state} in 60s…`);
				execFileSync("sleep", [String(RETRY_DELAY_MS / 1000)]);
			}
			const result = spawnSync(
				"bun",
				[INGEST_PATH, "US", "--state", state, "--db", db, "--use-cached-csv"],
				{ stdio: "inherit" }
			);
			if (result.status === 0) {
				succeeded = true;
				break;
			}
			// Transient drop mid-promote: the transaction either rolled back (0
			// rows for this state — clean retry) or committed before the ack was
			// lost (rows present — treat as done).
			if (stateRowCount(db, state) > 0) {
				console.log(
					`US/${state}: rows present after failure — promote committed, ack lost. Continuing.`
				);
				succeeded = true;
			}
		}
		if (!succeeded) {
			throw new Error(
				`US/${state} failed ${MAX_ATTEMPTS}x — queue stopped; re-run to resume`
			);
		}
		const mins = ((Date.now() - startedAt) / 60_000).toFixed(1);
		console.log(`===== US/${state} done in ${mins} min =====`);
	}
	console.log("\nUS queue complete");
}

main();
