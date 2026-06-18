import {
	type ApiEndpoint,
	type ApiEndpointId,
	apiExplorerEndpoints,
} from "@/lib/api-explorer-endpoints";

export type CapabilityIcon =
	| "MapPin"
	| "Locate"
	| "Shapes"
	| "Smartphone"
	| "Webhook"
	| "Globe2"
	| "Route";

export interface CapabilityCard {
	description: string;
	endpointIds: ApiEndpointId[];
	icon: CapabilityIcon;
	id: string;
	title: string;
}

/** One card per real SDK namespace. endpointIds must exist in apiExplorerEndpoints. */
export const capabilities: CapabilityCard[] = [
	{
		id: "addresses",
		icon: "MapPin",
		title: "Addresses",
		description:
			"Autocomplete, reverse geocoding, nearby search, and lookup by ID over authoritative address data.",
		endpointIds: [
			"addresses.autocomplete",
			"addresses.reverse",
			"addresses.nearby",
			"addresses.byId",
		],
	},
	{
		id: "geocode",
		icon: "Locate",
		title: "Geocode & batch",
		description:
			"Forward geocode single addresses, or submit batches and poll for results at scale.",
		endpointIds: [
			"addresses.geocode",
			"geocode.batch.submit",
			"geocode.batch.poll",
			"geocode.batch.results",
		],
	},
	{
		id: "zones",
		icon: "Shapes",
		title: "Zones & geofencing",
		description:
			"Create geofence polygons, test point containment, and list the addresses inside a zone.",
		endpointIds: ["zones.create", "zones.contains", "zones.addresses"],
	},
	{
		id: "devices",
		icon: "Smartphone",
		title: "Devices",
		description:
			"Push device locations and resolve which zones a device is currently inside.",
		endpointIds: ["devices.location.push", "devices.zones"],
	},
	{
		id: "webhooks",
		icon: "Webhook",
		title: "Webhooks",
		description:
			"Subscribe to events, then list, delete, and reactivate webhook endpoints.",
		endpointIds: ["webhooks.create", "webhooks.list", "webhooks.reactivate"],
	},
	{
		id: "regions",
		icon: "Globe2",
		title: "Regions",
		description:
			"Classify coordinates into official ABS/ASGS statistical regions.",
		endpointIds: ["regions.classify"],
	},
	{
		id: "routing",
		icon: "Route",
		title: "Routing",
		description:
			"Turn-by-turn directions between coordinates (distance matrices and isochrones via the SDK).",
		endpointIds: ["routing.directions"],
	},
];

/** Endpoints featured as tabs in the "API in action" showcase. GET-friendly. */
export const featuredEndpointIds: ApiEndpointId[] = [
	"addresses.autocomplete",
	"addresses.reverse",
	"addresses.nearby",
];

/** Short, illustrative example responses keyed by endpoint id (marked example in UI). */
export const featuredResponses: Partial<Record<ApiEndpointId, string>> = {
	"addresses.autocomplete": `{
  "results": [
    { "id": 123, "label": "123 Collins St, Melbourne VIC 3000", "lat": -37.8159, "lng": 144.9669 }
  ]
}`,
	"addresses.reverse": `{
  "result": { "id": 123, "label": "123 Collins St, Melbourne VIC 3000", "distanceMeters": 4 }
}`,
	"addresses.nearby": `{
  "results": [
    { "id": 123, "label": "123 Collins St, Melbourne VIC 3000", "distanceMeters": 42 }
  ]
}`,
};

export const DOCS_HREF = "/docs";

export const COVERAGE_LINE =
	"US and Australia at the core, with several European countries live and coverage actively expanding across South America, Europe, Africa, and Asia.";

export function endpointById(id: ApiEndpointId): ApiEndpoint {
	const found = apiExplorerEndpoints.find((endpoint) => endpoint.id === id);
	if (!found) {
		throw new Error(`Unknown endpoint id: ${id}`);
	}
	return found;
}

/** Build { name: example } from a catalog endpoint's documented param examples. */
export function exampleParamsForEndpoint(
	id: ApiEndpointId
): Record<string, string> {
	const entries = endpointById(id)
		.params.filter((param) => param.example !== undefined)
		.map((param) => [param.name, param.example as string] as const);
	return Object.fromEntries(entries);
}
