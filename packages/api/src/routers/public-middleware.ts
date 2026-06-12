import { timingSafeEqual } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { serverEnv } from "@wherabouts.com/env/server";
import {
	INTERNAL_API_AUTH_HEADER,
	INTERNAL_API_KEY_ID_HEADER,
	INTERNAL_REQUEST_SOURCE_HEADER,
	parseApiKeyFromRequest,
	REQUEST_SOURCE_EXPLORER_TEST,
	REQUEST_SOURCE_PRODUCTION,
	recordUsage,
	type ValidatedApiKey,
	validateApiKey,
	validateApiKeyById,
} from "../api-key-auth.ts";
import { o as baseBuilder } from "../builder.ts";
import { billingOwnerFromKey, getOrCreateBillingAccount } from "../billing/account.ts";

export type { ValidatedApiKey } from "../api-key-auth.ts";

// ---------------------------------------------------------------------------
// API-key auth middleware
// ---------------------------------------------------------------------------

/**
 * Constant-time string comparison. The internal-auth header gates the
 * validate-by-key-id path (auth without the key secret), so its comparison must
 * not leak the secret via timing. Returns false on null/length mismatch.
 */
const constantTimeEqual = (a: string | null, b: string): boolean => {
	if (a === null) {
		return false;
	}
	const aBuf = Buffer.from(a);
	const bBuf = Buffer.from(b);
	if (aBuf.length !== bBuf.length) {
		return false;
	}
	return timingSafeEqual(aBuf, bBuf);
};

const resolveTrustedRequestSource = (request: Request): string | null => {
	const authHeader = request.headers.get(INTERNAL_API_AUTH_HEADER);
	if (!constantTimeEqual(authHeader, serverEnv.BETTER_AUTH_SECRET)) {
		return null;
	}
	const source = request.headers.get(INTERNAL_REQUEST_SOURCE_HEADER);
	if (source === REQUEST_SOURCE_EXPLORER_TEST) {
		return source;
	}
	return null;
};

export const apiKeyAuth = baseBuilder.middleware(async ({ context, next }) => {
	const request = context.req.raw;
	const trustedRequestSource = resolveTrustedRequestSource(request);
	const internalApiKeyId =
		trustedRequestSource === REQUEST_SOURCE_EXPLORER_TEST
			? request.headers.get(INTERNAL_API_KEY_ID_HEADER)
			: null;
	const token = parseApiKeyFromRequest(request);

	let authResult: ValidatedApiKey | null = null;

	if (internalApiKeyId) {
		authResult = await validateApiKeyById(context.db, internalApiKeyId);
	} else if (token) {
		authResult = await validateApiKey(context.db, token);
	}

	if (!authResult) {
		const message =
			token || internalApiKeyId
				? "Invalid, revoked, or expired API key."
				: "API key required. Send Authorization: Bearer <key> or X-API-Key.";

		throw new ORPCError("UNAUTHORIZED", { message });
	}

	const requestSource = trustedRequestSource ?? REQUEST_SOURCE_PRODUCTION;
	if (requestSource === REQUEST_SOURCE_PRODUCTION) {
		const owner = billingOwnerFromKey({
			teamId: authResult.teamId,
			userId: authResult.userId,
		});
		const account = await getOrCreateBillingAccount(context.db, owner);
		if (account.blocked) {
			throw new ORPCError("PAYMENT_REQUIRED", {
				message:
					"Free tier exhausted. Add a payment method in your billing settings to continue.",
			});
		}
	}

	return next({
		context: {
			validatedApiKey: authResult,
			requestSource,
		},
	});
});

// ---------------------------------------------------------------------------
// Usage-recording middleware (runs after handler on success)
// ---------------------------------------------------------------------------

export function usageMiddleware(endpointKey: string) {
	return baseBuilder.middleware(async ({ context, next }) => {
		const result = await next({});

		const ctx = context as unknown as {
			db: typeof context.db;
			validatedApiKey: ValidatedApiKey;
			requestSource: string;
		};

		if (ctx.validatedApiKey) {
			recordUsage(ctx.db, {
				apiKeyId: ctx.validatedApiKey.apiKeyId,
				projectId: ctx.validatedApiKey.projectId,
				userId: ctx.validatedApiKey.userId,
				teamId: ctx.validatedApiKey.teamId,
				endpoint: endpointKey,
				requestSource: ctx.requestSource,
			}).catch((err: unknown) => {
				// Usage accounting must not fail the client response.
				// biome-ignore lint/suspicious/noConsole: observability for accounting failures
				console.error("[usage]", endpointKey, err);
			});
		}

		return result;
	});
}
