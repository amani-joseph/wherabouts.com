import { z } from "zod";
import { ok } from "../errors.ts";
import type { ToolDef } from "../types.ts";

const READ = { readOnlyHint: true } as const;

export const geocodingTools: ToolDef[] = [
	{
		name: "geocode_address",
		description:
			"Forward-geocode an address. Use `q` for freeform text, or set structured fields (street/locality/state/postcode/country) with structured='true'.",
		inputSchema: {
			q: z.string().optional(),
			street: z.string().optional(),
			locality: z.string().optional(),
			state: z.string().optional(),
			postcode: z.string().optional(),
			country: z.string().optional(),
			structured: z.enum(["true", "false"]).optional(),
		},
		annotations: READ,
		handler: (client, args) => client.geocode.forward(args as never).then(ok),
	},
	{
		name: "reverse_geocode",
		description: "Reverse-geocode a coordinate to the nearest known address.",
		inputSchema: {
			lat: z.number().min(-90).max(90),
			lng: z.number().min(-180).max(180),
		},
		annotations: READ,
		handler: (client, args) => client.addresses.reverse(args as never).then(ok),
	},
	{
		name: "autocomplete_address",
		description: "Type-ahead address suggestions for a partial query.",
		inputSchema: {
			q: z.string().min(1),
			country: z.string().optional(),
			state: z.string().optional(),
			lat: z.number().optional(),
			lng: z.number().optional(),
			limit: z.number().int().positive().optional(),
		},
		annotations: READ,
		handler: (client, args) =>
			client.addresses.autocomplete(args as never).then(ok),
	},
	{
		name: "nearby_addresses",
		description:
			"Find known addresses near a coordinate, optionally within a radius (metres).",
		inputSchema: {
			lat: z.number().min(-90).max(90),
			lng: z.number().min(-180).max(180),
			radius: z.number().positive().optional(),
			country: z.string().optional(),
			limit: z.number().int().positive().optional(),
		},
		annotations: READ,
		handler: (client, args) => client.addresses.nearby(args as never).then(ok),
	},
	{
		name: "classify_region",
		description:
			"Classify a coordinate into administrative regions (ABS layers).",
		inputSchema: {
			lat: z.number().min(-90).max(90),
			lng: z.number().min(-180).max(180),
			layers: z.string().optional(),
		},
		annotations: READ,
		handler: (client, args) => client.regions.classify(args as never).then(ok),
	},
];
