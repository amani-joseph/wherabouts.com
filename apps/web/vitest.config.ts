import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Standalone vitest config — deliberately does NOT extend the main
 * `vite.config.ts` because it pulls in the Cloudflare vite plugin which
 * is incompatible with vitest's node runner.
 */
export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(import.meta.dirname, "src"),
			"@wherabouts.com/ui": resolve(
				import.meta.dirname,
				"../../packages/ui/src"
			),
		},
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		// serverEnv (t3-env) validates all server vars eagerly on import; some
		// lib tests import it transitively. Provide the OSRM vars the routing
		// feature added so validation passes in the test runner.
		env: {
			OSRM_BASE_URL: "http://localhost:5000",
			OSRM_AUTH_TOKEN: "test-token",
		},
	},
});
