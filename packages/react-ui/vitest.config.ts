import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		include: [
			"src/**/*.test.ts",
			"src/**/*.test.tsx",
			".storybook/**/*.test.ts",
		],
		setupFiles: ["./src/test-setup.ts"],
		globals: true,
	},
});
