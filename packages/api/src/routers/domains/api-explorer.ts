import { ORPCError } from "@orpc/server";
import { apiKeys } from "@wherabouts.com/database/schema";
import { serverEnv } from "@wherabouts.com/env/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../../procedures.ts";

const INTERNAL_API_AUTH_HEADER = "x-wherabouts-internal-auth";
const INTERNAL_API_KEY_ID_HEADER = "x-wherabouts-internal-api-key-id";
const INTERNAL_REQUEST_SOURCE_HEADER = "x-wherabouts-request-source";
const REQUEST_SOURCE_EXPLORER_TEST = "explorer_test";
const RAW_KEY_FORMAT_RE = /^wh_[^_]+_.+$/i;

type ApiEndpointId =
	| "addresses.autocomplete"
	| "addresses.byId"
	| "addresses.nearby"
	| "addresses.reverse";

type ApiEndpoint = {
	id: ApiEndpointId;
	method: "GET";
	params: { name: string; pathParam?: boolean }[];
	path: string;
};

const endpointMap = new Map<ApiEndpointId, ApiEndpoint>([
	[
		"addresses.autocomplete",
		{
			id: "addresses.autocomplete",
			method: "GET",
			path: "/api/v1/addresses/autocomplete",
			params: [
				{ name: "q" },
				{ name: "country" },
				{ name: "state" },
				{ name: "limit" },
			],
		},
	],
	[
		"addresses.byId",
		{
			id: "addresses.byId",
			method: "GET",
			path: "/api/v1/addresses/{id}",
			params: [{ name: "id", pathParam: true }],
		},
	],
	[
		"addresses.nearby",
		{
			id: "addresses.nearby",
			method: "GET",
			path: "/api/v1/addresses/nearby",
			params: [
				{ name: "lat" },
				{ name: "lng" },
				{ name: "radius" },
				{ name: "limit" },
				{ name: "country" },
			],
		},
	],
	[
		"addresses.reverse",
		{
			id: "addresses.reverse",
			method: "GET",
			path: "/api/v1/addresses/reverse",
			params: [{ name: "lat" }, { name: "lng" }],
		},
	],
]);

const explorerRequestSchema = z.object({
	authMode: z.enum(["managed", "raw"]),
	endpointId: z.string(),
	managedKeyId: z.string().uuid().optional(),
	paramValues: z.record(z.string(), z.string()).default({}),
	rawApiKey: z.string().optional(),
});

const buildUrl = (
	endpoint: ApiEndpoint,
	paramValues: Record<string, string>
): string => {
	let url = endpoint.path;
	for (const param of endpoint.params) {
		if (param.pathParam) {
			url = url.replace(`{${param.name}}`, paramValues[param.name] ?? "");
		}
	}
	const queryParts: string[] = [];
	for (const param of endpoint.params) {
		if (!param.pathParam) {
			const value = paramValues[param.name];
			if (value) {
				queryParts.push(
					`${encodeURIComponent(param.name)}=${encodeURIComponent(value)}`
				);
			}
		}
	}
	if (queryParts.length > 0) {
		url = `${url}?${queryParts.join("&")}`;
	}
	return url;
};

const parseResponseBody = async (response: Response): Promise<unknown> => {
	const contentType = response.headers.get("content-type") ?? "";
	if (contentType.includes("application/json")) {
		return await response.json();
	}
	return await response.text();
};

export const apiExplorerRouter = {
	sendRequest: protectedProcedure
		.input(explorerRequestSchema)
		.handler(async ({ context, input }) => {
			const authUserId = context.session.user.id;

			const endpoint = endpointMap.get(input.endpointId as ApiEndpointId);
			if (!endpoint) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Unsupported API explorer endpoint.",
				});
			}

			const requestUrl = buildUrl(endpoint, input.paramValues);
			const targetUrl = new URL(requestUrl, serverEnv.BETTER_AUTH_URL);
			const headers = new Headers({
				accept: "application/json",
				[INTERNAL_API_AUTH_HEADER]: serverEnv.BETTER_AUTH_SECRET,
				[INTERNAL_REQUEST_SOURCE_HEADER]: REQUEST_SOURCE_EXPLORER_TEST,
			});

			if (input.authMode === "managed") {
				if (!input.managedKeyId) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Choose a managed API key before sending a test request.",
					});
				}

				const [managedKey] = await context.db
					.select({
						expiresAt: apiKeys.expiresAt,
						id: apiKeys.id,
						revokedAt: apiKeys.revokedAt,
					})
					.from(apiKeys)
					.where(
						and(
							eq(apiKeys.id, input.managedKeyId),
							eq(apiKeys.userId, authUserId)
						)
					)
					.limit(1);

				if (!managedKey) {
					throw new ORPCError("BAD_REQUEST", {
						message: "The selected API key does not belong to your account.",
					});
				}
				if (managedKey.revokedAt) {
					throw new ORPCError("BAD_REQUEST", {
						message: "The selected API key has been revoked.",
					});
				}
				if (
					managedKey.expiresAt &&
					managedKey.expiresAt.getTime() <= Date.now()
				) {
					throw new ORPCError("BAD_REQUEST", {
						message: "The selected API key has expired.",
					});
				}

				headers.set(INTERNAL_API_KEY_ID_HEADER, managedKey.id);
			} else {
				const rawApiKey = input.rawApiKey?.trim();
				if (!rawApiKey) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Paste a raw API key before sending a test request.",
					});
				}
				if (!RAW_KEY_FORMAT_RE.test(rawApiKey)) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Raw API keys must match the wh_<id>_<secret> format.",
					});
				}
				headers.set("Authorization", `Bearer ${rawApiKey}`);
			}

			const startedAt = Date.now();
			const response = await fetch(targetUrl, {
				method: endpoint.method,
				headers,
				cache: "no-store",
			});
			const durationMs = Date.now() - startedAt;
			const body = await parseResponseBody(response);

			return {
				body,
				durationMs,
				ok: response.ok,
				requestUrl,
				statusCode: response.status,
			};
		}),
};
