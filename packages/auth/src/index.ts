import { authSchema } from "@wherabouts.com/database";
import { serverEnv } from "@wherabouts.com/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db.ts";

const TRAILING_SLASH_REGEX = /\/$/;
const DEPLOYED_WEB_ORIGIN =
	process.env.DEPLOYED_WEB_ORIGIN ?? "https://wherabouts.com";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

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
	trustedOrigins,
	socialProviders: {
		github: {
			clientId: serverEnv.GITHUB_CLIENT_ID,
			clientSecret: serverEnv.GITHUB_CLIENT_SECRET,
			redirectURI: `${serverEnv.BETTER_AUTH_URL}/api/auth/callback/github`,
		},
	},
	advanced: {
		defaultCookieAttributes: {
			sameSite: IS_PRODUCTION ? "none" : "lax",
			secure: IS_PRODUCTION,
			httpOnly: true,
			...(IS_PRODUCTION && serverEnv.AUTH_COOKIE_DOMAIN
				? { domain: serverEnv.AUTH_COOKIE_DOMAIN }
				: {}),
		},
	},
});
