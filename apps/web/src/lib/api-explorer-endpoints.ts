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
	| "addresses.reverse";

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
