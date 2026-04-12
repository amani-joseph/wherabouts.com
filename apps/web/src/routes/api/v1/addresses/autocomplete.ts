import { createFileRoute } from "@tanstack/react-router";
import { autocompleteAddresses } from "@wherabouts.com/database/queries";
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

				if (!query || query.trim().length < 2) {
					return Response.json(
						{
							error: "Query parameter 'q' must be at least 2 characters",
						},
						{ status: 400 }
					);
				}

				const results = await autocompleteAddresses(db, query, {
					country,
					state,
					limit,
				});

				return Response.json({ results, count: results.length });
			}),
		},
	},
});
