import type { AuthConfig } from "convex/server";

const clerkJwtIssuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;
if (!clerkJwtIssuerDomain) {
	throw new Error(
		"CLERK_JWT_ISSUER_DOMAIN is not set. Add it to packages/backend/.env.local (Clerk Frontend API URL, https://… .accounts.dev) and run `npx convex env set CLERK_JWT_ISSUER_DOMAIN <url>`. See https://docs.convex.dev/auth/clerk"
	);
}

export default {
	providers: [
		{
			domain: clerkJwtIssuerDomain,
			applicationID: "convex",
		},
	],
} satisfies AuthConfig;
