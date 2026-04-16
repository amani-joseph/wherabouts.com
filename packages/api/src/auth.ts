import { authSchema } from "@wherabouts.com/database";
import { serverEnv } from "@wherabouts.com/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db.ts";

const TRAILING_SLASH_REGEX = /\/$/;
const DEPLOYED_WEB_ORIGIN =
	process.env.DEPLOYED_WEB_ORIGIN ?? "https://wherabouts.com";
const isProduction = serverEnv.BETTER_AUTH_URL.includes("wherabouts.com");

const trustedOrigins = Array.from(
	new Set([
		serverEnv.WEB_BASE_URL.replace(TRAILING_SLASH_REGEX, ""),
		DEPLOYED_WEB_ORIGIN,
		"http://localhost:3001",
		"https://wherabouts.com",
		"https://api.wherabouts.com",
	])
);

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
	trustedOrigins,
	socialProviders: {
		github: {
			clientId: serverEnv.GITHUB_CLIENT_ID,
			clientSecret: serverEnv.GITHUB_CLIENT_SECRET,
			redirectURI: `${serverEnv.BETTER_AUTH_URL}/api/auth/callback/github`,
		},
	},
	advanced: {
		...(isProduction && {
			crossSubDomainCookies: {
				enabled: true,
				domain: "wherabouts.com",
			},
		}),
	},
});
