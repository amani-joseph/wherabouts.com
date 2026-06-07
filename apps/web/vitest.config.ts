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
	},
});
