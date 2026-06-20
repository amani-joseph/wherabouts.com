// Build-consumption smoke test: verifies both the ESM and CJS dist entry points
// resolve and expose a working public API. Run AFTER `pnpm build`, via Node (not
// vitest) so it exercises real module resolution of the published artifacts.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const distEsm = resolve(here, "../dist/index.js");
const distCjs = resolve(here, "../dist/index.cjs");
// Read the expected version from package.json so this check never drifts.
const pkg = JSON.parse(readFileSync(resolve(here, "../package.json"), "utf8"));

const failures = [];

// ESM
const esm = await import(distEsm);
if (typeof esm.createWheraboutsClient !== "function") {
	failures.push("ESM: createWheraboutsClient is not a function");
}
if (typeof esm.WheraboutsApiError !== "function") {
	failures.push("ESM: WheraboutsApiError is not exported");
}
if (esm.WHERABOUTS_SDK_VERSION !== pkg.version) {
	failures.push(
		`ESM: version ${esm.WHERABOUTS_SDK_VERSION} != package.json ${pkg.version}`
	);
}
const esmClient = esm.createWheraboutsClient({ apiKey: "wh_smoke" });
for (const ns of [
	"addresses",
	"geocode",
	"zones",
	"devices",
	"webhooks",
	"regions",
]) {
	if (!esmClient[ns]) {
		failures.push(`ESM: client.${ns} missing`);
	}
}

// CJS
const require = createRequire(import.meta.url);
const cjs = require(distCjs);
if (typeof cjs.createWheraboutsClient !== "function") {
	failures.push("CJS: createWheraboutsClient is not a function");
}
const cjsClient = cjs.createWheraboutsClient({ apiKey: "wh_smoke" });
if (typeof cjsClient.zones.create !== "function") {
	failures.push("CJS: client.zones.create missing");
}

if (failures.length > 0) {
	console.error(`Smoke test FAILED:\n${failures.join("\n")}`);
	process.exit(1);
}
console.log(
	"Smoke test PASSED: ESM + CJS dist resolve and expose the public API."
);
