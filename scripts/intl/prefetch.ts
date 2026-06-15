/**
 * Extract-only prefetch: pulls one country's Overture extract to the canonical
 * CSV path while another country's DB load runs (extract is S3/CPU-bound and
 * touches no database). Writes to `<csv>.part` and renames on success, so a
 * half-written file is never mistaken for a valid cache.
 *
 * Usage: bun scripts/intl/prefetch.ts <COUNTRY>
 */

import { existsSync, renameSync, rmSync } from "node:fs";
import { runExtract } from "./adapters/overture";
import { getCountryConfig, OVERTURE_RELEASE } from "./lib/source-registry";

const country = (process.argv[2] ?? "").toUpperCase();
if (!country) {
	throw new Error("Usage: prefetch.ts <COUNTRY>");
}
const config = getCountryConfig(country);
if (config.adapter !== "overture") {
	console.log(`prefetch: ${country} uses ${config.adapter} adapter — skipping`);
	process.exit(0);
}

const csvPath = `/tmp/overture-${country.toLowerCase()}.csv`;
if (existsSync(csvPath)) {
	console.log(`prefetch: ${csvPath} already cached`);
	process.exit(0);
}

const partPath = `${csvPath}.part`;
rmSync(partPath, { force: true });
console.log(`prefetch: extracting ${country}…`);
const { rowCount } = runExtract(country, config, OVERTURE_RELEASE, partPath);
renameSync(partPath, csvPath);
console.log(`prefetch: ${country} ready (${rowCount} rows)`);
