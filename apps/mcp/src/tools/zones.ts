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

const DESTRUCTIVE = { destructiveHint: true, readOnlyHint: false } as const;

const geometry = z.object({
	type: z.literal("Polygon"),
	coordinates: z.array(z.array(z.array(z.number()))),
});

export const zoneManagementTools: ToolDef[] = [
	{
		name: "create_zone",
		description: "Create a geofence zone from a GeoJSON Polygon.",
		inputSchema: {
			name: z.string().min(1),
			geometry,
			description: z.string().optional(),
			metadata: z.record(z.string(), z.unknown()).optional(),
		},
		annotations: DESTRUCTIVE,
		handler: (client, args) => client.zones.create(args as never).then(ok),
	},
	{
		name: "update_zone",
		description:
			"Update a geofence zone's name, geometry, description, or metadata.",
		inputSchema: {
			id: z.number().int(),
			name: z.string().min(1).optional(),
			geometry: geometry.optional(),
			description: z.string().optional(),
			metadata: z.record(z.string(), z.unknown()).optional(),
		},
		annotations: DESTRUCTIVE,
		handler: (client, args) => {
			const { id, ...body } = args as { id: number };
			return client.zones.update(id, body as never).then(ok);
		},
	},
	{
		name: "delete_zone",
		description:
			"Permanently delete a geofence zone. Requires confirm=true; set it only after the user has agreed to the deletion.",
		inputSchema: {
			id: z.number().int(),
			confirm: z.boolean().optional(),
		},
		annotations: { ...DESTRUCTIVE, idempotentHint: true },
		handler: (client, args) => {
			if (args.confirm !== true) {
				return Promise.resolve({
					content: [
						{
							type: "text" as const,
							text: "Refusing to delete: call again with confirm=true to confirm permanent deletion.",
						},
					],
					isError: true,
				});
			}
			return client.zones.delete(args.id as number).then(ok);
		},
	},
];

export const zoneTools: ToolDef[] = [...zoneReadTools, ...zoneManagementTools];
