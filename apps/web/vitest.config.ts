import { defineConfig } from "vitest/config";

/**
 * Standalone vitest config — deliberately does NOT extend the main
 * `vite.config.ts` because it pulls in the Cloudflare vite plugin which
 * is incompatible with vitest's node runner.
 */
export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
	},
});
