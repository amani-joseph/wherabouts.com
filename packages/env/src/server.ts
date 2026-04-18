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
		RESEND_API_KEY: z.string().min(1),
		EMAIL_FROM: z.string().email(),
		KEY_ENC_KEY: z
			.string()
			.regex(
				/^[0-9a-fA-F]{64}$/,
				"KEY_ENC_KEY must be 64 hex chars (32 bytes)"
			),
	},
	runtimeEnv: {
		...process.env,
		WEB_BASE_URL: process.env.WEB_BASE_URL ?? "http://localhost:3001",
		RESEND_API_KEY: process.env.RESEND_API_KEY,
		EMAIL_FROM: process.env.EMAIL_FROM,
		KEY_ENC_KEY: process.env.KEY_ENC_KEY,
	},
	emptyStringAsUndefined: true,
});
