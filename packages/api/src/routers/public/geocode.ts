import { ORPCError } from "@orpc/server";
import { autocompleteAddresses } from "@wherabouts.com/database/queries";
import { z } from "zod";
import { o as baseBuilder } from "../../builder.ts";
import { apiKeyAuth, usageMiddleware } from "../public-middleware.ts";

// ---------------------------------------------------------------------------
// Query builder (pure, exported for unit tests)
// ---------------------------------------------------------------------------

export function buildGeocodeQuery(
	input:
		| { structured: false; q: string }
		| {
				structured: true;
				street: string;
				locality: string;
				state?: string;
				postcode?: string;
				country?: string;
		  }
): string {
	if (!input.structured) {
		return input.q;
	}
	return [input.street, input.locality, input.state]
		.filter(Boolean)
		.join(", ");
}

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const unstructuredInput = z.object({
	structured: z.literal(false),
	q: z.string().min(5, "Query parameter 'q' must be at least 5 characters."),
	country: z.string().optional(),
	state: z.string().optional(),
});

const structuredInput = z.object({
	structured: z.literal(true),
	street: z.string().min(1, "Parameter 'street' is required in structured mode."),
	locality: z.string().min(1, "Parameter 'locality' is required in structured mode."),
	state: z.string().optional(),
	postcode: z.string().optional(),
	country: z.string().optional(),
});

const geocodeInput = z.discriminatedUnion("structured", [
	structuredInput,
	unstructuredInput,
]);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const forwardGeocode = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("addresses.geocode"))
	.route({
		method: "GET",
		path: "/api/v1/addresses/geocode",
		summary: "Forward geocode an address",
		tags: ["addresses"],
	})
	.input(geocodeInput)
	.handler(async ({ input, context }) => {
		const isStructured = input.structured === true;

		// Build the query string
		let query: string;
		let country: string | undefined;
		let state: string | undefined;

		if (isStructured) {
			query = buildGeocodeQuery({
				structured: true,
				street: input.street,
				locality: input.locality,
				state: input.state,
				postcode: input.postcode,
				country: input.country,
			});
			country = input.country;
			state = input.state;
		} else {
			query = buildGeocodeQuery({ structured: false, q: input.q });
			country = input.country;
			state = input.state;
		}

		const { results } = await autocompleteAddresses(context.db, query, {
			country,
			state,
			limit: 1,
		});

		if (results.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "No address found matching the query.",
			});
		}

		// biome-ignore lint: length check above guarantees existence
		const result = results[0]!;

		return {
			address: {
				id: result.id,
				formattedAddress: result.formattedAddress,
				streetAddress: result.streetAddress,
				locality: result.locality,
				state: result.state,
				postcode: result.postcode,
				country: result.country,
				latitude: result.latitude,
				longitude: result.longitude,
			},
			matchType: isStructured ? ("structured" as const) : ("fuzzy" as const),
		};
	});
