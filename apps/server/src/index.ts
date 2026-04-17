import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import {
	appRouter,
	createContext,
	publicHttpRouter,
} from "@wherabouts.com/api";
import { auth } from "@wherabouts.com/auth";
import { serverEnv } from "@wherabouts.com/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

const TRAILING_SLASH_REGEX = /\/$/;
const DEPLOYED_WEB_ORIGIN =
	process.env.DEPLOYED_WEB_ORIGIN ?? "https://wherabouts.com";

const allowedOrigins = new Set([
	serverEnv.WEB_BASE_URL.replace(TRAILING_SLASH_REGEX, ""),
	DEPLOYED_WEB_ORIGIN,
	"http://localhost:3001",
]);

const isAllowedOrigin = (origin: string | undefined): boolean =>
	typeof origin === "string" && allowedOrigins.has(origin);

app.use(logger());
app.use(
	"/*",
	cors({
		origin: (origin) => {
			if (isAllowedOrigin(origin)) {
				return origin;
			}
			return undefined;
		},
		allowHeaders: [
			"Authorization",
			"Content-Type",
			"X-API-Key",
			"x-wherabouts-internal-auth",
			"x-wherabouts-internal-api-key-id",
			"x-wherabouts-request-source",
		],
		allowMethods: ["GET", "POST", "OPTIONS"],
		credentials: true,
	})
);

app.on(["GET", "POST"], "/api/auth/*", async (context) => {
	try {
		const response = await auth.handler(context.req.raw);
		return response;
	} catch (error: unknown) {
		console.error("[auth] handler error:", error);
		return context.json({ error: "Internal auth error" }, { status: 500 });
	}
});

// ---------------------------------------------------------------------------
// Map ORPCError codes to our API error codes (Fix #2: complete mapping)
// ---------------------------------------------------------------------------

const ORPC_TO_API_ERROR: Record<string, { status: number; code: string }> = {
	BAD_REQUEST: { status: 400, code: "bad_request" },
	UNAUTHORIZED: { status: 401, code: "unauthorized" },
	FORBIDDEN: { status: 403, code: "unauthorized" },
	NOT_FOUND: { status: 404, code: "not_found" },
	METHOD_NOT_SUPPORTED: { status: 405, code: "bad_request" },
	NOT_ACCEPTABLE: { status: 406, code: "bad_request" },
	TIMEOUT: { status: 408, code: "bad_request" },
	CONFLICT: { status: 409, code: "bad_request" },
	PRECONDITION_FAILED: { status: 412, code: "bad_request" },
	PAYLOAD_TOO_LARGE: { status: 413, code: "bad_request" },
	UNSUPPORTED_MEDIA_TYPE: { status: 415, code: "bad_request" },
	UNPROCESSABLE_CONTENT: { status: 422, code: "bad_request" },
	TOO_MANY_REQUESTS: { status: 429, code: "bad_request" },
	CLIENT_CLOSED_REQUEST: { status: 499, code: "bad_request" },
	INTERNAL_SERVER_ERROR: { status: 500, code: "internal_error" },
	NOT_IMPLEMENTED: { status: 501, code: "internal_error" },
	BAD_GATEWAY: { status: 502, code: "internal_error" },
	SERVICE_UNAVAILABLE: { status: 503, code: "internal_error" },
	GATEWAY_TIMEOUT: { status: 504, code: "internal_error" },
};

/**
 * Reformat an OpenAPIHandler error response into the
 * `{ error: { code, message } }` shape for strict compat.
 * Also ensures cache-control: no-store on error responses.
 */
async function reformatErrorResponse(response: Response): Promise<Response> {
	if (response.ok) {
		return response;
	}

	try {
		const body: unknown = await response.json();
		const record =
			body && typeof body === "object"
				? (body as Record<string, unknown>)
				: null;

		// oRPC wraps all errors (including Zod validation) as ORPCError with
		// shape: { code: "BAD_REQUEST", status: 400, message: "..." }
		// Zod validation messages appear in the `message` field directly.
		if (record && "code" in record) {
			const mapped = ORPC_TO_API_ERROR[record.code as string];
			const errorCode = mapped?.code ?? "internal_error";
			const status = mapped?.status ?? response.status;
			const message =
				typeof record.message === "string" && record.message.length > 0
					? record.message
					: "An unexpected error occurred.";

			return Response.json(
				{ error: { code: errorCode, message } },
				{ status, headers: { "cache-control": "no-store" } }
			);
		}

		// Fallback: wrap unknown error body
		const fallbackMessage =
			record && typeof record.message === "string"
				? record.message
				: "An unexpected error occurred.";

		return Response.json(
			{ error: { code: "internal_error", message: fallbackMessage } },
			{ status: response.status, headers: { "cache-control": "no-store" } }
		);
	} catch {
		return response;
	}
}

// ---------------------------------------------------------------------------
// OpenAPI handler for public /api/v1/* endpoints
// ---------------------------------------------------------------------------

const openApiHandler = new OpenAPIHandler(publicHttpRouter, {
	interceptors: [
		onError((err: unknown) => {
			if (!(err instanceof ORPCError)) {
				console.error("[openapi]", err);
			}
		}),
	],
});

// Derive endpoint key from path for Server-Timing metric name
function endpointKeyFromPath(pathname: string): string {
	if (pathname.includes("/autocomplete")) {
		return "addresses_autocomplete";
	}
	if (pathname.includes("/nearby")) {
		return "addresses_nearby";
	}
	if (pathname.includes("/reverse")) {
		return "addresses_reverse";
	}
	return "addresses_byId";
}

app.use("/api/v1/*", async (context) => {
	const startedAt = performance.now();
	const rpcContext = await createContext({ req: context.req });
	const result = await openApiHandler.handle(context.req.raw, {
		prefix: "/" as `/${string}`,
		context: rpcContext,
	});

	if (!result.matched) {
		return context.json(
			{ error: { code: "not_found", message: "Endpoint not found." } },
			404
		);
	}

	// Reformat error responses for strict compat
	const response = await reformatErrorResponse(result.response);

	// Fix #1: Ensure cache-control on ALL responses (success + error)
	if (!response.headers.has("cache-control")) {
		response.headers.set("cache-control", "no-store");
	}

	// Add Server-Timing header
	const durationMs = performance.now() - startedAt;
	const metric = endpointKeyFromPath(new URL(context.req.url).pathname);
	response.headers.set(
		"Server-Timing",
		`${metric};dur=${durationMs.toFixed(1)}`
	);

	return context.newResponse(response.body, response);
});

// ---------------------------------------------------------------------------
// RPC handler for /rpc/*
// ---------------------------------------------------------------------------

const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((err: unknown) => {
			console.error("[rpc]", err);
		}),
	],
});

app.use("/*", async (context, next) => {
	// localFetch routes requests through the Hono app in-process, avoiding
	// Cloudflare's self-subrequest restriction (error 1042).
	const localFetch: (
		url: string | URL,
		init?: RequestInit
	) => Promise<Response> = async (url, init) =>
		app.request(url instanceof URL ? url.toString() : url, init);

	const rpcContext = await createContext({ localFetch, req: context.req });
	const rpcResult = await rpcHandler.handle(context.req.raw, {
		prefix: "/rpc",
		context: rpcContext,
	});

	if (rpcResult.matched) {
		return context.newResponse(rpcResult.response.body, rpcResult.response);
	}

	await next();
});

app.get("/", (context) =>
	context.json({ ok: true, service: "wherabouts-server" })
);

export default {
	fetch: app.fetch,
};
