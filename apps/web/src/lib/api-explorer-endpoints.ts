export type ApiParam = {
	description: string;
	example?: string;
	name: string;
	required: boolean;
	type: string;
};

export type ApiEndpointId =
	| "addresses.autocomplete"
	| "addresses.byId"
	| "addresses.nearby"
	| "addresses.reverse"
	// Geocoding
	| "addresses.geocode"
	| "geocode.batch.submit"
	| "geocode.batch.poll"
	| "geocode.batch.results"
	// Zones
	| "zones.create"
	| "zones.list"
	| "zones.get"
	| "zones.update"
	| "zones.delete"
	| "zones.contains"
	| "zones.addresses"
	// Devices
	| "devices.location.push"
	| "devices.zones"
	// Webhooks
	| "webhooks.create"
	| "webhooks.list"
	| "webhooks.delete";

export type ApiEndpoint = {
	description: string;
	id: ApiEndpointId;
	method: "GET" | "POST" | "PUT" | "DELETE";
	params: ApiParam[];
	path: string;
	summary: string;
};

export const apiExplorerEndpoints: ApiEndpoint[] = [
	{
		id: "addresses.autocomplete",
		method: "GET",
		path: "/api/v1/addresses/autocomplete",
		summary: "Autocomplete addresses",
		description:
			"Search for addresses matching a partial query string. Returns up to 20 results ordered by relevance.",
		params: [
			{
				name: "q",
				type: "string",
				required: true,
				description: "Search query (minimum 2 characters)",
				example: "123 Main",
			},
			{
				name: "country",
				type: "string",
				required: false,
				description: "Filter by country code (e.g. AU)",
				example: "AU",
			},
			{
				name: "state",
				type: "string",
				required: false,
				description: "Filter by state (e.g. VIC, NSW)",
				example: "VIC",
			},
			{
				name: "limit",
				type: "number",
				required: false,
				description: "Maximum results to return (1-20, default 10)",
				example: "10",
			},
		],
	},
	{
		id: "addresses.byId",
		method: "GET",
		path: "/api/v1/addresses/{id}",
		summary: "Get address by ID",
		description:
			"Retrieve a single address record by its unique numeric identifier.",
		params: [
			{
				name: "id",
				type: "number",
				required: true,
				description: "Unique address ID",
				example: "1",
			},
		],
	},
	{
		id: "addresses.nearby",
		method: "GET",
		path: "/api/v1/addresses/nearby",
		summary: "Find nearby addresses",
		description:
			"Find addresses within a given radius of a geographic coordinate. Results are ordered by distance.",
		params: [
			{
				name: "lat",
				type: "number",
				required: true,
				description: "Latitude (-90 to 90)",
				example: "-37.8136",
			},
			{
				name: "lng",
				type: "number",
				required: true,
				description: "Longitude (-180 to 180)",
				example: "144.9631",
			},
			{
				name: "radius",
				type: "number",
				required: false,
				description: "Search radius in meters (max 50000, default 1000)",
				example: "500",
			},
			{
				name: "limit",
				type: "number",
				required: false,
				description: "Maximum results to return (1-50, default 10)",
				example: "10",
			},
			{
				name: "country",
				type: "string",
				required: false,
				description: "Filter by country code",
				example: "AU",
			},
		],
	},
	{
		id: "addresses.reverse",
		method: "GET",
		path: "/api/v1/addresses/reverse",
		summary: "Reverse geocode",
		description:
			"Find the closest address to a given coordinate. Searches within 200 meters and returns the single nearest match.",
		params: [
			{
				name: "lat",
				type: "number",
				required: true,
				description: "Latitude (-90 to 90)",
				example: "-37.8136",
			},
			{
				name: "lng",
				type: "number",
				required: true,
				description: "Longitude (-180 to 180)",
				example: "144.9631",
			},
		],
	},
	// --- Geocoding (GET endpoints are executable; POST is docs-only) ---
	{
		id: "addresses.geocode",
		method: "GET",
		path: "/api/v1/addresses/geocode",
		summary: "Forward geocode an address",
		description:
			"Resolve a free-form address string or structured fields to a canonical address with coordinates.",
		params: [
			{
				name: "q",
				type: "string",
				required: false,
				description: "Unstructured address text (minimum 5 characters)",
				example: "123 Main St Melbourne VIC",
			},
			{
				name: "structured",
				type: "string",
				required: false,
				description: "Set to true to use structured field inputs",
				example: "false",
			},
			{
				name: "street",
				type: "string",
				required: false,
				description: "Street address line (structured mode)",
				example: "123 Main St",
			},
			{
				name: "locality",
				type: "string",
				required: false,
				description: "Suburb or city name (structured mode)",
				example: "Melbourne",
			},
			{
				name: "state",
				type: "string",
				required: false,
				description: "State abbreviation (structured mode)",
				example: "VIC",
			},
			{
				name: "postcode",
				type: "string",
				required: false,
				description: "Postcode (structured mode)",
				example: "3000",
			},
			{
				name: "country",
				type: "string",
				required: false,
				description: "Country code",
				example: "AU",
			},
		],
	},
	// POST /geocode/batch — docs-only (not wired to GET-only sendRequest proxy)
	{
		id: "geocode.batch.submit",
		method: "POST",
		path: "/api/v1/geocode/batch",
		summary: "Submit a batch geocoding job",
		description:
			"Submit an array of address strings for background geocoding. Returns a jobId immediately. POST with JSON body — use the curl example in the docs page to test.",
		params: [],
	},
	{
		id: "geocode.batch.poll",
		method: "GET",
		path: "/api/v1/geocode/batch/{jobId}",
		summary: "Poll batch job status",
		description:
			"Check the status of a running batch geocoding job. Poll until status is completed or failed.",
		params: [
			{
				name: "jobId",
				type: "string",
				required: true,
				description: "Job ID returned by batch submit",
				example: "job_abc123xyz",
			},
		],
	},
	{
		id: "geocode.batch.results",
		method: "GET",
		path: "/api/v1/geocode/batch/{jobId}/results",
		summary: "Fetch completed batch results",
		description:
			"Retrieve geocoded results once the batch job status is completed.",
		params: [
			{
				name: "jobId",
				type: "string",
				required: true,
				description: "Job ID returned by batch submit",
				example: "job_abc123xyz",
			},
		],
	},
	// --- Zones (GET endpoints executable; POST/PUT/DELETE docs-only) ---
	// POST /zones — docs-only
	{
		id: "zones.create",
		method: "POST",
		path: "/api/v1/zones",
		summary: "Create a zone",
		description:
			"Create a named geofence zone defined by a GeoJSON Polygon. POST with JSON body — use the curl example in the docs page to test.",
		params: [],
	},
	{
		id: "zones.list",
		method: "GET",
		path: "/api/v1/zones",
		summary: "List zones for a project",
		description:
			"Return all zones for a project including their GeoJSON geometry.",
		params: [
			{
				name: "projectId",
				type: "string",
				required: true,
				description: "Project identifier",
				example: "proj_abc",
			},
		],
	},
	{
		id: "zones.get",
		method: "GET",
		path: "/api/v1/zones/{id}",
		summary: "Get a zone by ID",
		description: "Fetch a single zone record including geometry.",
		params: [
			{
				name: "id",
				type: "string",
				required: true,
				description: "Zone identifier",
				example: "zone_01HX3K9R",
			},
		],
	},
	// PUT /zones/{id} — docs-only
	{
		id: "zones.update",
		method: "PUT",
		path: "/api/v1/zones/{id}",
		summary: "Update a zone",
		description:
			"Replace a zone's name or geometry. PUT with JSON body — use the curl example in the docs page to test.",
		params: [
			{
				name: "id",
				type: "string",
				required: true,
				description: "Zone identifier",
				example: "zone_01HX3K9R",
			},
		],
	},
	// DELETE /zones/{id} — docs-only
	{
		id: "zones.delete",
		method: "DELETE",
		path: "/api/v1/zones/{id}",
		summary: "Delete a zone",
		description:
			"Permanently delete a zone. DELETE request — use the curl example in the docs page to test.",
		params: [
			{
				name: "id",
				type: "string",
				required: true,
				description: "Zone identifier",
				example: "zone_01HX3K9R",
			},
		],
	},
	{
		id: "zones.contains",
		method: "GET",
		path: "/api/v1/zones/contains",
		summary: "Point-in-polygon zone test",
		description:
			"Test whether a coordinate falls inside any project zone using PostGIS ST_Contains.",
		params: [
			{
				name: "projectId",
				type: "string",
				required: true,
				description: "Project identifier",
				example: "proj_abc",
			},
			{
				name: "lat",
				type: "number",
				required: true,
				description: "Latitude (-90 to 90)",
				example: "-37.8136",
			},
			{
				name: "lng",
				type: "number",
				required: true,
				description: "Longitude (-180 to 180)",
				example: "144.9631",
			},
		],
	},
	{
		id: "zones.addresses",
		method: "GET",
		path: "/api/v1/zones/{id}/addresses",
		summary: "List addresses inside a zone",
		description:
			"Return paginated addresses whose coordinates fall inside the zone polygon.",
		params: [
			{
				name: "id",
				type: "string",
				required: true,
				description: "Zone identifier",
				example: "zone_01HX3K9R",
			},
			{
				name: "limit",
				type: "number",
				required: false,
				description: "Maximum addresses to return (1-10000, default 100)",
				example: "100",
			},
			{
				name: "offset",
				type: "number",
				required: false,
				description: "Pagination offset",
				example: "0",
			},
		],
	},
	// --- Devices (POST is docs-only; GET executable) ---
	// POST /devices/{deviceId}/location — docs-only
	{
		id: "devices.location.push",
		method: "POST",
		path: "/api/v1/devices/{deviceId}/location",
		summary: "Push a device location update",
		description:
			"Record a device position and detect zone crossings. POST with JSON body — use the curl example in the docs page to test.",
		params: [
			{
				name: "deviceId",
				type: "string",
				required: true,
				description: "Device identifier",
				example: "truck-42",
			},
		],
	},
	{
		id: "devices.zones",
		method: "GET",
		path: "/api/v1/devices/{deviceId}/zones",
		summary: "Get current zones for a device",
		description:
			"Return the zones that contain the device's most recently recorded position.",
		params: [
			{
				name: "deviceId",
				type: "string",
				required: true,
				description: "Device identifier",
				example: "truck-42",
			},
			{
				name: "projectId",
				type: "string",
				required: true,
				description: "Project identifier",
				example: "proj_abc",
			},
		],
	},
	// --- Webhooks (POST/DELETE docs-only; GET executable) ---
	// POST /webhooks — docs-only
	{
		id: "webhooks.create",
		method: "POST",
		path: "/api/v1/webhooks",
		summary: "Create a webhook subscription",
		description:
			"Subscribe to zone boundary crossing events. POST with JSON body — use the curl example in the docs page to test.",
		params: [],
	},
	{
		id: "webhooks.list",
		method: "GET",
		path: "/api/v1/webhooks",
		summary: "List webhook subscriptions",
		description:
			"Return all webhook subscriptions for a project (signing secret not included).",
		params: [
			{
				name: "projectId",
				type: "string",
				required: true,
				description: "Project identifier",
				example: "proj_abc",
			},
		],
	},
	// DELETE /webhooks/{id} — docs-only
	{
		id: "webhooks.delete",
		method: "DELETE",
		path: "/api/v1/webhooks/{id}",
		summary: "Delete a webhook subscription",
		description:
			"Permanently remove a webhook subscription. DELETE request — use the curl example in the docs page to test.",
		params: [
			{
				name: "id",
				type: "string",
				required: true,
				description: "Webhook subscription identifier",
				example: "wh_01HX9AB",
			},
		],
	},
];

export const apiExplorerEndpointMap = new Map(
	apiExplorerEndpoints.map((endpoint) => [endpoint.id, endpoint])
);

export const buildApiExplorerUrl = (
	endpoint: ApiEndpoint,
	paramValues: Record<string, string>
): string => {
	let url = endpoint.path;

	for (const param of endpoint.params) {
		const pathToken = `{${param.name}}`;
		if (url.includes(pathToken)) {
			url = url.replace(pathToken, paramValues[param.name] ?? "");
		}
	}

	const queryParams = endpoint.params.filter(
		(param) => !endpoint.path.includes(`{${param.name}}`)
	);
	const searchParts: string[] = [];

	for (const param of queryParams) {
		const value = paramValues[param.name];
		if (value) {
			searchParts.push(
				`${encodeURIComponent(param.name)}=${encodeURIComponent(value)}`
			);
		}
	}

	if (searchParts.length > 0) {
		url = `${url}?${searchParts.join("&")}`;
	}

	return url;
};
