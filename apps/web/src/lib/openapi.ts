import { createApiErrorBody } from "./api-response";

const errorSchema = {
	type: "object",
	required: ["error"],
	properties: {
		error: {
			type: "object",
			required: ["code", "message"],
			properties: {
				code: {
					type: "string",
					enum: ["bad_request", "internal_error", "not_found", "unauthorized"],
				},
				message: { type: "string" },
			},
		},
	},
} as const;

export const getOpenApiDocument = () =>
	({
		openapi: "3.1.0",
		info: {
			title: "Wherabouts Public API",
			version: "1.0.0",
			description:
				"Production-grade address lookup endpoints for autocomplete, reverse geocoding, nearby search, and canonical address retrieval.",
		},
		servers: [{ url: "https://api.wherabouts.com" }],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "API Key",
					description: "Send `Authorization: Bearer wh_<id>_<secret>`.",
				},
				apiKeyAuth: {
					type: "apiKey",
					in: "header",
					name: "X-API-Key",
				},
			},
			schemas: {
				ApiError: errorSchema,
			},
		},
		security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
		paths: {
			"/api/v1/addresses/autocomplete": {
				get: {
					operationId: "addresses.autocomplete",
					summary: "Autocomplete addresses",
					parameters: [
						{
							name: "q",
							in: "query",
							required: true,
							schema: { type: "string", minLength: 2 },
							description: "Free-form address query.",
						},
						{
							name: "country",
							in: "query",
							required: false,
							schema: { type: "string" },
							description: "Optional country filter such as `AU`.",
						},
						{
							name: "state",
							in: "query",
							required: false,
							schema: { type: "string" },
							description: "Optional state filter such as `VIC`.",
						},
						{
							name: "limit",
							in: "query",
							required: false,
							schema: { type: "integer", minimum: 1, maximum: 20, default: 10 },
							description: "Maximum results to return.",
						},
					],
					responses: {
						"200": {
							description: "Autocomplete matches",
							content: {
								"application/json": {
									schema: {
										type: "object",
										required: ["results", "count"],
										properties: {
											results: {
												type: "array",
												items: { type: "object", additionalProperties: true },
											},
											count: { type: "integer" },
										},
									},
								},
							},
						},
						"400": {
							description: "Validation error",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ApiError" },
									example: createApiErrorBody(
										"bad_request",
										"Query parameter 'q' must be at least 2 characters."
									),
								},
							},
						},
						"401": {
							description: "Authentication error",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ApiError" },
									example: createApiErrorBody(
										"unauthorized",
										"Invalid, revoked, or expired API key."
									),
								},
							},
						},
					},
				},
			},
			"/api/v1/addresses/reverse": {
				get: {
					operationId: "addresses.reverse",
					summary: "Reverse geocode coordinates",
					parameters: [
						{
							name: "lat",
							in: "query",
							required: true,
							schema: { type: "number", minimum: -90, maximum: 90 },
						},
						{
							name: "lng",
							in: "query",
							required: true,
							schema: { type: "number", minimum: -180, maximum: 180 },
						},
					],
					responses: {
						"200": {
							description: "Nearest address result",
							content: {
								"application/json": {
									schema: {
										type: "object",
										required: ["address", "distance", "query"],
										properties: {
											address: { type: "object", additionalProperties: true },
											distance: { type: "integer" },
											query: { type: "object", additionalProperties: true },
										},
									},
								},
							},
						},
						"400": {
							description: "Validation error",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ApiError" },
								},
							},
						},
						"401": {
							description: "Authentication error",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ApiError" },
								},
							},
						},
						"404": {
							description: "No address found",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ApiError" },
								},
							},
						},
					},
				},
			},
			"/api/v1/addresses/nearby": {
				get: {
					operationId: "addresses.nearby",
					summary: "Find nearby addresses",
					parameters: [
						{
							name: "lat",
							in: "query",
							required: true,
							schema: { type: "number", minimum: -90, maximum: 90 },
						},
						{
							name: "lng",
							in: "query",
							required: true,
							schema: { type: "number", minimum: -180, maximum: 180 },
						},
						{
							name: "radius",
							in: "query",
							required: false,
							schema: {
								type: "number",
								minimum: 1,
								maximum: 50_000,
								default: 1000,
							},
						},
						{
							name: "limit",
							in: "query",
							required: false,
							schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
						},
						{
							name: "country",
							in: "query",
							required: false,
							schema: { type: "string" },
						},
					],
					responses: {
						"200": {
							description: "Nearby address results",
							content: {
								"application/json": {
									schema: {
										type: "object",
										required: ["results", "count", "query"],
										properties: {
											results: {
												type: "array",
												items: { type: "object", additionalProperties: true },
											},
											count: { type: "integer" },
											query: { type: "object", additionalProperties: true },
										},
									},
								},
							},
						},
						"400": {
							description: "Validation error",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ApiError" },
								},
							},
						},
						"401": {
							description: "Authentication error",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ApiError" },
								},
							},
						},
					},
				},
			},
			"/api/v1/addresses/{id}": {
				get: {
					operationId: "addresses.byId",
					summary: "Get address by ID",
					parameters: [
						{
							name: "id",
							in: "path",
							required: true,
							schema: { type: "integer" },
							description: "Canonical address ID from a prior response.",
						},
					],
					responses: {
						"200": {
							description: "Canonical address payload",
							content: {
								"application/json": {
									schema: {
										type: "object",
										required: ["id"],
										properties: {
											id: { type: "integer" },
										},
										additionalProperties: true,
									},
								},
							},
						},
						"400": {
							description: "Validation error",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ApiError" },
								},
							},
						},
						"401": {
							description: "Authentication error",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ApiError" },
								},
							},
						},
						"404": {
							description: "Unknown address ID",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ApiError" },
								},
							},
						},
					},
				},
			},
		},
	}) as const;
