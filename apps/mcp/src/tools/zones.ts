import { z } from "zod";
import { ok } from "../errors.ts";
import type { ToolDef } from "../types.ts";

const READ = { readOnlyHint: true } as const;

export const zoneReadTools: ToolDef[] = [
	{
		name: "list_zones",
		description: "List geofence zones in the caller's project.",
		inputSchema: {
			limit: z.number().int().positive().optional(),
			page: z.number().int().positive().optional(),
		},
		annotations: READ,
		handler: (client, args) => client.zones.list(args as never).then(ok),
	},
	{
		name: "get_zone",
		description: "Get a single geofence zone (with geometry) by id.",
		inputSchema: { id: z.number().int() },
		annotations: READ,
		handler: (client, args) => client.zones.get(args.id as number).then(ok),
	},
	{
		name: "zones_containing_point",
		description: "Find the zones that contain a given coordinate.",
		inputSchema: {
			lat: z.number().min(-90).max(90),
			lng: z.number().min(-180).max(180),
		},
		annotations: READ,
		handler: (client, args) =>
			client.zones
				.contains({ lat: args.lat as number, lng: args.lng as number })
				.then(ok),
	},
	{
		name: "zone_addresses",
		description: "List the known addresses that fall within a zone.",
		inputSchema: {
			id: z.number().int(),
			limit: z.number().int().positive().optional(),
			page: z.number().int().positive().optional(),
		},
		annotations: READ,
		handler: (client, args) => {
			const { id, ...paging } = args as {
				id: number;
				limit?: number;
				page?: number;
			};
			return client.zones.addresses(id, paging).then(ok);
		},
	},
];
