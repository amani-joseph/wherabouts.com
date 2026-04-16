import { ORPCError } from "@orpc/server";
import { autocompleteAddresses } from "@wherabouts.com/database/queries";
import { addresses } from "@wherabouts.com/database/schema";
import { serverEnv } from "@wherabouts.com/env/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
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

// ---------------------------------------------------------------------------
// API-key auth middleware
// ---------------------------------------------------------------------------

const resolveTrustedRequestSource = (request: Request): string | null => {
	const authHeader = request.headers.get(INTERNAL_API_AUTH_HEADER);
	if (authHeader !== serverEnv.BETTER_AUTH_SECRET) {
		return null;
	}
	const source = request.headers.get(INTERNAL_REQUEST_SOURCE_HEADER);
	if (source === REQUEST_SOURCE_EXPLORER_TEST) {
		return source;
	}
	return null;
};

const apiKeyAuth = baseBuilder.middleware(async ({ context, next }) => {
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

	return next({
		context: {
			validatedApiKey: authResult,
			requestSource: trustedRequestSource ?? REQUEST_SOURCE_PRODUCTION,
		},
	});
});

// ---------------------------------------------------------------------------
// Usage-recording middleware (runs after handler on success)
// ---------------------------------------------------------------------------

function usageMiddleware(endpointKey: string) {
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

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

const autocomplete = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("addresses.autocomplete"))
	.route({
		method: "GET",
		path: "/api/v1/addresses/autocomplete",
		summary: "Autocomplete address search",
		tags: ["addresses"],
	})
	.input(
		z
			.object({
				q: z
					.string()
					.min(2, "Query parameter 'q' must be at least 2 characters."),
				country: z.string().optional(),
				state: z.string().optional(),
				limit: z.coerce.number().int().min(1).max(20).default(10),
				lat: z.coerce.number().min(-90).max(90).optional(),
				lon: z.coerce.number().min(-180).max(180).optional(),
			})
			.refine((data) => (data.lat === undefined) === (data.lon === undefined), {
				message: "Both 'lat' and 'lon' must be provided together.",
			})
	)
	.handler(async ({ input, context }) => {
		const results = await autocompleteAddresses(context.db, input.q, {
			country: input.country,
			state: input.state,
			limit: input.limit,
			latitude: input.lat,
			longitude: input.lon,
		});
		return { results, count: results.length };
	});

const nearby = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("addresses.nearby"))
	.route({
		method: "GET",
		path: "/api/v1/addresses/nearby",
		summary: "Find addresses near a point",
		tags: ["addresses"],
	})
	.input(
		z.object({
			lat: z.coerce.number().min(-90).max(90),
			lng: z.coerce.number().min(-180).max(180),
			radius: z.coerce.number().min(1).max(50_000).default(1000),
			limit: z.coerce.number().int().min(1).max(50).default(10),
			country: z.string().optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const { lat, lng, radius, limit, country } = input;
		const point = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
		const geomGeo = sql`${addresses.geom}::geography`;

		const filters = [sql`ST_DWithin(${geomGeo}, ${point}, ${radius})`];
		if (country) {
			filters.push(sql`${addresses.country} = ${country.toUpperCase()}`);
		}

		const rows = await context.db
			.select({
				id: addresses.id,
				country: addresses.country,
				state: addresses.state,
				locality: addresses.locality,
				postcode: addresses.postcode,
				streetName: addresses.streetName,
				streetType: addresses.streetType,
				numberFirst: addresses.numberFirst,
				numberLast: addresses.numberLast,
				buildingName: addresses.buildingName,
				flatType: addresses.flatType,
				flatNumber: addresses.flatNumber,
				longitude: addresses.longitude,
				latitude: addresses.latitude,
				distance: sql<number>`ST_Distance(${geomGeo}, ${point})`.as("distance"),
			})
			.from(addresses)
			.where(and(...filters))
			.orderBy(sql`ST_Distance(${geomGeo}, ${point})`)
			.limit(limit);

		return {
			results: rows.map((row) => ({
				...row,
				distance: Math.round(row.distance),
			})),
			count: rows.length,
			query: { lat, lng, radius },
		};
	});

const reverse = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("addresses.reverse"))
	.route({
		method: "GET",
		path: "/api/v1/addresses/reverse",
		summary: "Reverse geocode coordinates to an address",
		tags: ["addresses"],
	})
	.input(
		z.object({
			lat: z.coerce.number().min(-90).max(90),
			lng: z.coerce.number().min(-180).max(180),
		})
	)
	.handler(async ({ input, context }) => {
		const { lat, lng } = input;
		const point = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
		const geomGeo = sql`${addresses.geom}::geography`;

		const rows = await context.db
			.select({
				id: addresses.id,
				country: addresses.country,
				state: addresses.state,
				locality: addresses.locality,
				postcode: addresses.postcode,
				streetName: addresses.streetName,
				streetType: addresses.streetType,
				streetSuffix: addresses.streetSuffix,
				numberFirst: addresses.numberFirst,
				numberLast: addresses.numberLast,
				buildingName: addresses.buildingName,
				flatType: addresses.flatType,
				flatNumber: addresses.flatNumber,
				levelType: addresses.levelType,
				levelNumber: addresses.levelNumber,
				longitude: addresses.longitude,
				latitude: addresses.latitude,
				confidence: addresses.confidence,
				gnafPid: addresses.gnafPid,
				distance: sql<number>`ST_Distance(${geomGeo}, ${point})`.as("distance"),
			})
			.from(addresses)
			.where(sql`ST_DWithin(${geomGeo}, ${point}, 200)`)
			.orderBy(sql`ST_Distance(${geomGeo}, ${point})`)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "No address found within 200m of the given coordinates.",
			});
		}

		// biome-ignore lint: length check above guarantees existence
		const row = rows[0]!;
		const numberRange = row.numberLast
			? `${row.numberFirst}-${row.numberLast}`
			: row.numberFirst;
		const streetParts = [
			numberRange,
			row.streetName,
			row.streetType,
			row.streetSuffix,
		].filter(Boolean);

		return {
			address: {
				id: row.id,
				formattedAddress: `${streetParts.join(" ")}, ${row.locality} ${row.state} ${row.postcode}, ${row.country}`,
				streetAddress: streetParts.join(" "),
				locality: row.locality,
				state: row.state,
				postcode: row.postcode,
				country: row.country,
				longitude: row.longitude,
				latitude: row.latitude,
				confidence: row.confidence,
			},
			distance: Math.round(row.distance),
			query: { lat, lng },
		};
	});

const byId = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("addresses.byId"))
	.route({
		method: "GET",
		path: "/api/v1/addresses/{id}",
		summary: "Get address by ID",
		tags: ["addresses"],
	})
	.input(
		z.object({
			id: z.coerce.number().int().min(1),
		})
	)
	.handler(async ({ input, context }) => {
		const rows = await context.db
			.select()
			.from(addresses)
			.where(eq(addresses.id, input.id))
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Address not found." });
		}

		// biome-ignore lint: length check above guarantees existence
		const row = rows[0]!;
		return {
			id: row.id,
			country: row.country,
			state: row.state,
			locality: row.locality,
			postcode: row.postcode,
			streetName: row.streetName,
			streetType: row.streetType,
			streetSuffix: row.streetSuffix,
			buildingName: row.buildingName,
			flatType: row.flatType,
			flatNumber: row.flatNumber,
			levelType: row.levelType,
			levelNumber: row.levelNumber,
			numberFirst: row.numberFirst,
			numberLast: row.numberLast,
			longitude: row.longitude,
			latitude: row.latitude,
			confidence: row.confidence,
			gnafPid: row.gnafPid,
		};
	});

// ---------------------------------------------------------------------------
// Router (separate from appRouter — only used by OpenAPIHandler)
// ---------------------------------------------------------------------------

export const publicHttpRouter = {
	addresses: {
		autocomplete,
		nearby,
		reverse,
		byId,
	},
};

export type PublicHttpRouter = typeof publicHttpRouter;
