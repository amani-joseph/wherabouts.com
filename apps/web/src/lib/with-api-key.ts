import type { Database } from "@wherabouts.com/database";
import {
	parseApiKeyFromRequest,
	recordUsage,
	validateApiKey,
} from "./api-key-auth.ts";
import { getDb } from "./db.ts";

const UNAUTHORIZED = (message: string) =>
	Response.json({ error: "unauthorized", message }, { status: 401 });

export function withApiKeyGET<C extends { request: Request }>(
	endpointKey: string,
	handler: (ctx: C & { db: Database }) => Promise<Response>
): (ctx: C) => Promise<Response> {
	return async (ctx) => {
		const token = parseApiKeyFromRequest(ctx.request);
		if (!token) {
			return UNAUTHORIZED(
				"API key required. Send Authorization: Bearer <key> or X-API-Key."
			);
		}

		const db = getDb();
		const authResult = await validateApiKey(db, token);
		if (!authResult) {
			return UNAUTHORIZED("Invalid or revoked API key.");
		}

		const response = await handler({ ...ctx, db });

		if (response.status >= 200 && response.status < 300) {
			void recordUsage(db, {
				apiKeyId: authResult.apiKeyId,
				clerkUserId: authResult.clerkUserId,
				endpoint: endpointKey,
			}).catch(() => {
				// Usage accounting must not fail the client response
			});
		}

		return response;
	};
}
