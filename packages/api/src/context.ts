import { auth } from "@wherabouts.com/auth";
import type {
	accounts,
	sessions,
	users,
	verifications,
} from "@wherabouts.com/database";
import type { InferSelectModel } from "drizzle-orm";
import type { HonoRequest } from "hono";
import { db } from "./db.ts";

/**
 * A fetch-like function that routes requests through the Hono app
 * in-process, avoiding Cloudflare's self-subrequest restriction (error 1042).
 */
export type LocalFetch = (
	url: string | URL,
	init?: RequestInit
) => Promise<Response>;

/**
 * Cloudflare Worker environment bindings passed through to oRPC context.
 * Typed loosely here to avoid a hard dependency on @cloudflare/workers-types
 * in this package.
 */
export interface CloudflareEnv {
	// biome-ignore lint/suspicious/noExplicitAny: CF binding types not in this package
	BATCH_GEOCODE_QUEUE?: any;
	// biome-ignore lint/suspicious/noExplicitAny: CF binding types not in this package
	GEOCODE_RESULTS?: any;
	// biome-ignore lint/suspicious/noExplicitAny: CF binding types not in this package
	WEBHOOK_DELIVERY_QUEUE?: any;
}

export interface CreateContextOptions {
	env?: CloudflareEnv;
	localFetch?: LocalFetch;
	req: HonoRequest;
}

export const createContext = async ({
	env,
	localFetch,
	req,
}: CreateContextOptions) => {
	const session = await auth.api.getSession({
		headers: req.raw.headers,
	});

	return {
		db,
		env,
		localFetch,
		req,
		session,
	};
};

export type Context = Awaited<ReturnType<typeof createContext>>;
export type AuthAccount = InferSelectModel<typeof accounts>;
export type AuthSession = InferSelectModel<typeof sessions>;
export type AuthUser = InferSelectModel<typeof users>;
export type AuthVerification = InferSelectModel<typeof verifications>;
