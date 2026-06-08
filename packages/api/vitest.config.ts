import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		env: {
			DATABASE_URL: "postgresql://test:test@localhost:5432/test",
			BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long!!",
			BETTER_AUTH_URL: "http://localhost:3002",
			GITHUB_CLIENT_ID: "test-github-client-id",
			GITHUB_CLIENT_SECRET: "test-github-client-secret",
			WEB_BASE_URL: "http://localhost:3001",
			RESEND_API_KEY: "re_test_key",
			EMAIL_FROM: "test@example.com",
			KEY_ENC_KEY: "0".repeat(64),
			OSRM_BASE_URL: "http://localhost:5000",
			OSRM_AUTH_TOKEN: "test-token",
		},
	},
});
