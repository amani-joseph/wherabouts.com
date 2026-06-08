import { ORPCError } from "@orpc/server";
import type { Database } from "@wherabouts.com/database";
import { serverEnv } from "@wherabouts.com/env/server";
import { z } from "zod";
import { o as baseBuilder } from "../../builder.ts";
import {
	fetchOsrmRoute,
	type LatLng,
	parseLatLng,
	RoutingError,
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
			profile: z.literal("driving").default("driving"),
		})
	)
	.handler(async ({ input, context }) => {
		const { from, to } = await resolveDirectionsInput(context.db, input);
		try {
			const route = await fetchOsrmRoute(from, to, {
				baseUrl: serverEnv.OSRM_BASE_URL,
				authToken: serverEnv.OSRM_AUTH_TOKEN,
				// Bind to globalThis — Workers' native fetch throws "Illegal invocation"
				// if called with a non-global `this` (it's invoked as options.fetchImpl).
				fetchImpl: globalThis.fetch.bind(globalThis),
			});
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
