import { ORPCError } from "@orpc/server";
import type { Database } from "@wherabouts.com/database";
import { serverEnv } from "@wherabouts.com/env/server";
import { z } from "zod";
import { o as baseBuilder } from "../../builder.ts";
import {
	generateSamplePoints,
	hullPolygon,
	IsochroneError,
	reachablePoints,
	regionsOverlappingIsochrone,
} from "../../shared/isochrone-queries.ts";
import { parseLayers } from "../../shared/region-queries.ts";
import {
	fetchOsrmRoute,
	fetchOsrmTable,
	type LatLng,
	parseLatLng,
	RoutingError,
	type RoutingProfile,
	resolveAddressCoords,
} from "../../shared/routing-queries.ts";
import { apiKeyAuth, usageMiddleware } from "../public-middleware.ts";

interface DirectionsInput {
	from?: string;
	fromAddressId?: number;
	to?: string;
	toAddressId?: number;
}

/**
 * Resolve one endpoint (origin or destination) to coordinates. Exactly one of
 * { coordString, addressId } must be present.
 */
async function resolveEndpoint(
	db: Database,
	label: string,
	coordString: string | undefined,
	addressId: number | undefined
): Promise<LatLng> {
	if (coordString !== undefined && addressId !== undefined) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Provide either '${label}' coordinates or '${label}AddressId', not both.`,
		});
	}
	if (addressId !== undefined) {
		const coords = await resolveAddressCoords(db, addressId);
		if (!coords) {
			throw new ORPCError("NOT_FOUND", {
				message: `Address ${addressId} not found.`,
			});
		}
		return coords;
	}
	if (coordString !== undefined) {
		const parsed = parseLatLng(coordString);
		if (!parsed) {
			throw new ORPCError("BAD_REQUEST", {
				message: `'${label}' must be a valid "lat,lng" coordinate.`,
			});
		}
		return parsed;
	}
	throw new ORPCError("BAD_REQUEST", {
		message: `Provide '${label}' coordinates or '${label}AddressId'.`,
	});
}

/** Exported for unit testing the input-resolution logic. */
export async function resolveDirectionsInput(
	db: Database,
	input: DirectionsInput
): Promise<{ from: LatLng; to: LatLng }> {
	const from = await resolveEndpoint(
		db,
		"from",
		input.from,
		input.fromAddressId
	);
	const to = await resolveEndpoint(db, "to", input.to, input.toAddressId);
	return { from, to };
}

export const routingDirections = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("routing.directions"))
	.route({
		method: "GET",
		path: "/api/v1/routing/directions",
		summary: "Driving directions between two points",
		tags: ["routing"],
	})
	.input(
		z.object({
			from: z.string().optional(),
			to: z.string().optional(),
			fromAddressId: z.coerce.number().int().min(1).optional(),
			toAddressId: z.coerce.number().int().min(1).optional(),
			profile: z.enum(["driving", "walking", "cycling"]).default("driving"),
		})
	)
	.handler(async ({ input, context }) => {
		const { from, to } = await resolveDirectionsInput(context.db, input);
		try {
			const route = await fetchOsrmRoute(
				from,
				to,
				{
					baseUrl: serverEnv.OSRM_BASE_URL,
					authToken: serverEnv.OSRM_AUTH_TOKEN,
					// Bind to globalThis — Workers' native fetch throws "Illegal invocation"
					// if called with a non-global `this` (it's invoked as options.fetchImpl).
					fetchImpl: globalThis.fetch.bind(globalThis),
				},
				input.profile
			);
			return {
				query: { from, to, profile: input.profile },
				distance_m: route.distance_m,
				duration_s: route.duration_s,
				geometry: route.geometry,
			};
		} catch (error) {
			if (error instanceof RoutingError && error.kind === "no_route") {
				throw new ORPCError("UNPROCESSABLE_CONTENT", {
					message: error.message,
				});
			}
			if (error instanceof RoutingError) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Routing service unavailable.",
				});
			}
			throw error;
		}
	});

/** Max points per side; keeps coords ≤ OSRM's default `--max-table-size` (100). */
const MAX_MATRIX_POINTS_PER_SIDE = 25;

/**
 * Resolve a delimited matrix side into coordinates. Each `|`-separated item is
 * either a `"lat,lng"` coordinate or a bare positive integer (a G-NAF address
 * id), letting GET callers mix both without the `z.coerce` pitfall (everything
 * arrives as a string here).
 */
export async function resolveMatrixPoints(
	db: Database,
	label: string,
	items: string[]
): Promise<LatLng[]> {
	const points: LatLng[] = [];
	for (const item of items) {
		if (item.includes(",")) {
			const parsed = parseLatLng(item);
			if (!parsed) {
				throw new ORPCError("BAD_REQUEST", {
					message: `'${label}' has an invalid "lat,lng" point: ${item}`,
				});
			}
			points.push(parsed);
			continue;
		}
		const addressId = Number(item);
		if (!(Number.isInteger(addressId) && addressId >= 1)) {
			throw new ORPCError("BAD_REQUEST", {
				message: `'${label}' has an invalid point (expected "lat,lng" or an address id): ${item}`,
			});
		}
		const coords = await resolveAddressCoords(db, addressId);
		if (!coords) {
			throw new ORPCError("NOT_FOUND", {
				message: `Address ${addressId} not found.`,
			});
		}
		points.push(coords);
	}
	return points;
}

const splitPoints = (raw: string): string[] =>
	raw
		.split("|")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

/**
 * Split + validate the two matrix sides (shape only — no DB). Throws
 * `BAD_REQUEST` on an empty or over-limit side. Exported for unit testing.
 */
export function parseMatrixSides(
	sourcesRaw: string,
	destinationsRaw: string
): { sourceItems: string[]; destItems: string[] } {
	const sourceItems = splitPoints(sourcesRaw);
	const destItems = splitPoints(destinationsRaw);
	if (sourceItems.length === 0 || destItems.length === 0) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Provide at least one 'sources' and one 'destinations' point.",
		});
	}
	if (
		sourceItems.length > MAX_MATRIX_POINTS_PER_SIDE ||
		destItems.length > MAX_MATRIX_POINTS_PER_SIDE
	) {
		throw new ORPCError("BAD_REQUEST", {
			message: `A matrix is limited to ${MAX_MATRIX_POINTS_PER_SIDE} sources and ${MAX_MATRIX_POINTS_PER_SIDE} destinations.`,
		});
	}
	return { sourceItems, destItems };
}

export const routingMatrix = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("routing.matrix"))
	.route({
		method: "GET",
		path: "/api/v1/routing/matrix",
		summary: "N×M duration/distance matrix between sources and destinations",
		tags: ["routing"],
	})
	.input(
		z.object({
			// Delimited `"lat,lng|lat,lng|<addressId>"`. Kept as strings so the
			// GET `z.coerce` pitfall never applies to a numeric scalar here.
			sources: z.string(),
			destinations: z.string(),
			profile: z.enum(["driving", "walking", "cycling"]).default("driving"),
		})
	)
	.handler(async ({ input, context }) => {
		const { sourceItems, destItems } = parseMatrixSides(
			input.sources,
			input.destinations
		);

		const sources = await resolveMatrixPoints(
			context.db,
			"sources",
			sourceItems
		);
		const destinations = await resolveMatrixPoints(
			context.db,
			"destinations",
			destItems
		);

		// One combined coordinate list; sources index first, destinations after.
		const coords = [...sources, ...destinations];
		const sourceIdx = sources.map((_, i) => i);
		const destIdx = destinations.map((_, i) => sources.length + i);

		try {
			const table = await fetchOsrmTable(coords, {
				baseUrl: serverEnv.OSRM_BASE_URL,
				authToken: serverEnv.OSRM_AUTH_TOKEN,
				fetchImpl: globalThis.fetch.bind(globalThis),
				profile: input.profile,
				sources: sourceIdx,
				destinations: destIdx,
			});
			return {
				query: { profile: input.profile },
				durations: table.durations,
				distances: table.distances,
				sources: table.sources,
				destinations: table.destinations,
			};
		} catch (error) {
			if (error instanceof RoutingError) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Routing service unavailable.",
				});
			}
			throw error;
		}
	});

/**
 * Generous per-profile speed ceiling (m/s) used only to size the sampling
 * radius from a duration budget — the outer ring must over-reach the true
 * isochrone so the hull captures its boundary. driving ~108 km/h, cycling
 * ~29 km/h, walking ~9 km/h.
 */
const PROFILE_MAX_SPEED_MPS: Record<RoutingProfile, number> = {
	driving: 30,
	cycling: 8,
	walking: 2.5,
};

export const routingIsochrone = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("routing.isochrone"))
	.route({
		method: "GET",
		path: "/api/v1/routing/isochrone",
		summary: "Reachability isochrone polygon for an origin + travel budget",
		tags: ["routing"],
	})
	.input(
		z
			.object({
				// "lat,lng" or a bare G-NAF address id (string ⇒ no z.coerce pitfall).
				origin: z.string(),
				profile: z.enum(["driving", "walking", "cycling"]).default("driving"),
				durationSeconds: z.coerce.number().positive().optional(),
				distanceMeters: z.coerce.number().positive().optional(),
				includeRegions: z
					.enum(["true", "false"])
					.default("false")
					.transform((v) => v === "true"),
				layers: z.string().optional(),
			})
			.refine(
				(d) =>
					(d.durationSeconds === undefined) !==
					(d.distanceMeters === undefined),
				{
					message:
						"Provide exactly one of 'durationSeconds' or 'distanceMeters'.",
				}
			)
	)
	.handler(async ({ input, context }) => {
		const points = await resolveMatrixPoints(context.db, "origin", [
			input.origin,
		]);
		const origin = points[0];
		if (!origin) {
			throw new ORPCError("BAD_REQUEST", { message: "Provide an 'origin'." });
		}

		const isDuration = input.durationSeconds !== undefined;
		const budget = (
			isDuration ? input.durationSeconds : input.distanceMeters
		) as number;
		const maxRadiusMeters = isDuration
			? budget * PROFILE_MAX_SPEED_MPS[input.profile]
			: budget;

		const samples = generateSamplePoints(origin, { maxRadiusMeters });
		const coords = [origin, ...samples];

		try {
			const table = await fetchOsrmTable(coords, {
				baseUrl: serverEnv.OSRM_BASE_URL,
				authToken: serverEnv.OSRM_AUTH_TOKEN,
				fetchImpl: globalThis.fetch.bind(globalThis),
				profile: input.profile,
				sources: [0],
			});
			const metric = isDuration ? table.durations : table.distances;
			const reachable = reachablePoints(metric, coords, budget);
			const polygon = await hullPolygon(context.db, reachable);
			const regions = input.includeRegions
				? await regionsOverlappingIsochrone(
						context.db,
						polygon,
						parseLayers(input.layers)
					)
				: undefined;

			return {
				query: {
					origin,
					profile: input.profile,
					durationSeconds: input.durationSeconds,
					distanceMeters: input.distanceMeters,
				},
				polygon,
				...(regions ? { regions } : {}),
			};
		} catch (error) {
			if (error instanceof IsochroneError) {
				throw new ORPCError("UNPROCESSABLE_CONTENT", {
					message: error.message,
				});
			}
			if (error instanceof RoutingError) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Routing service unavailable.",
				});
			}
			throw error;
		}
	});
