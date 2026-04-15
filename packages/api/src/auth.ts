import { authSchema } from "@wherabouts.com/database";
import { serverEnv } from "@wherabouts.com/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db.ts";

export const auth = betterAuth({
	baseURL: serverEnv.BETTER_AUTH_URL,
	secret: serverEnv.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: authSchema,
	}),
	emailAndPassword: {
		enabled: true,
	},
	trustedOrigins: [serverEnv.BETTER_AUTH_URL, serverEnv.WEB_BASE_URL],
});
