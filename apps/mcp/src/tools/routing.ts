import { z } from "zod";
import { ok } from "../errors.ts";
import type { ToolDef } from "../types.ts";

const READ = { readOnlyHint: true } as const;
const profile = z.enum(["driving", "walking", "cycling"]).optional();

/**
 * Widened from brief's {lat,lng} — MatchPoint extends LatLng with:
 *   radius?: number   (GPS accuracy in metres)
 *   timestamp?: number (UNIX seconds; all-or-none, strictly increasing)
 */
const matchPoint = z.object({
	lat: z.number(),
	lng: z.number(),
	radius: z.number().optional(),
	timestamp: z.number().optional(),
});

/**
 * Widened from brief's {lat,lng} — OptimizeWaypoint fields are all optional:
 *   addressId?: number  (G-NAF address id, alternative to lat/lng)
 *   lat?: number
 *   lng?: number
 */
const optimizeWaypoint = z.object({
	lat: z.number().optional(),
	lng: z.number().optional(),
	addressId: z.number().int().optional(),
});

export const routingTools: ToolDef[] = [
	{
		name: "get_directions",
		description:
			"Driving/walking/cycling directions between two points. Each endpoint is `from`/`to` as 'lat,lng' or an address id via fromAddressId/toAddressId.",
		inputSchema: {
			from: z.string().optional(),
			to: z.string().optional(),
			fromAddressId: z.number().int().optional(),
			toAddressId: z.number().int().optional(),
			profile,
		},
		annotations: READ,
		handler: (client, args) =>
			client.routing.directions(args as never).then(ok),
	},
	{
		name: "travel_matrix",
		description:
			"N×M duration/distance matrix. `sources` and `destinations` are 'lat,lng|lat,lng|<addressId>' delimited strings (≤25 points each).",
		inputSchema: {
			sources: z.string().min(1),
			destinations: z.string().min(1),
			profile,
		},
		annotations: READ,
		handler: (client, args) => client.routing.matrix(args as never).then(ok),
	},
	{
		name: "isochrone",
		description:
			"Reachability polygon for an origin and a travel budget. Provide exactly one of durationSeconds or distanceMeters. `origin` is 'lat,lng' or an address id string.",
		inputSchema: {
			origin: z.string().optional(),
			originAddressId: z.number().int().optional(),
			durationSeconds: z.number().positive().optional(),
			distanceMeters: z.number().positive().optional(),
			includeRegions: z.boolean().optional(),
			layers: z.string().optional(),
			profile,
		},
		annotations: READ,
		handler: (client, args) => client.routing.isochrone(args as never).then(ok),
	},
	{
		name: "match_trace",
		description:
			"Snap a sequence of GPS points to the road network (map-matching).",
		inputSchema: {
			coordinates: z.array(matchPoint).min(2),
			gaps: z.enum(["split", "ignore"]).optional(),
			tidy: z.boolean().optional(),
			profile,
		},
		annotations: READ,
		handler: (client, args) => client.routing.match(args as never).then(ok),
	},
	{
		name: "optimize_stops",
		description:
			"Optimise the visiting order of a set of stops (travelling-salesman).",
		inputSchema: {
			waypoints: z.array(optimizeWaypoint).min(2),
			roundtrip: z.boolean().optional(),
			source: z.enum(["any", "first"]).optional(),
			destination: z.enum(["any", "last"]).optional(),
			profile,
		},
		annotations: READ,
		handler: (client, args) => client.routing.optimize(args as never).then(ok),
	},
];
