import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const serverEnv = createEnv({
	server: {
		DATABASE_URL: z.string().url(),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.string().url(),
		GITHUB_CLIENT_ID: z.string().min(1),
		GITHUB_CLIENT_SECRET: z.string().min(1),
		WEB_BASE_URL: z.string().url(),
		AUTH_COOKIE_DOMAIN: z.string().optional(),
		PORT: z.coerce.number().int().positive().default(3002),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: {
		...process.env,
		WEB_BASE_URL: process.env.WEB_BASE_URL ?? "http://localhost:3001",
	},
	emptyStringAsUndefined: true,
});
