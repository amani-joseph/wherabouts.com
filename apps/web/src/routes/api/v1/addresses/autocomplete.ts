import { createFileRoute } from "@tanstack/react-router";
import { autocompleteAddresses } from "@wherabouts.com/database/queries";
import { jsonApiError } from "../../../../lib/api-response";
import { withApiKeyGET } from "../../../../lib/with-api-key";

export const Route = createFileRoute("/api/v1/addresses/autocomplete")({
	server: {
		handlers: {
			GET: withApiKeyGET("addresses.autocomplete", async ({ request, db }) => {
				const url = new URL(request.url);
				const query = url.searchParams.get("q");
				const country = url.searchParams.get("country") ?? undefined;
				const state = url.searchParams.get("state") ?? undefined;
				const limitParam = url.searchParams.get("limit");
				const limit = limitParam
					? Math.min(Number.parseInt(limitParam, 10), 20)
					: 10;
				const latParam = url.searchParams.get("lat");
				const lonParam = url.searchParams.get("lon");
				const latitude = latParam ? Number.parseFloat(latParam) : undefined;
				const longitude = lonParam ? Number.parseFloat(lonParam) : undefined;

				if (!query || query.trim().length < 2) {
					return jsonApiError(
						400,
						"bad_request",
						"Query parameter 'q' must be at least 2 characters.",
					);
				}

				if ((latitude !== undefined) !== (longitude !== undefined)) {
					return jsonApiError(
						400,
						"bad_request",
						"Both 'lat' and 'lon' must be provided together.",
					);
				}

				if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
					return jsonApiError(
						400,
						"bad_request",
						"Parameter 'lat' must be between -90 and 90.",
					);
				}

				if (
					longitude !== undefined &&
					(longitude < -180 || longitude > 180)
				) {
					return jsonApiError(
						400,
						"bad_request",
						"Parameter 'lon' must be between -180 and 180.",
					);
				}

				const results = await autocompleteAddresses(db, query, {
					country,
					state,
					limit,
					latitude,
					longitude,
				});

				return Response.json({ results, count: results.length });
			}),
		},
	},
});
