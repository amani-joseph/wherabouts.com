import { createFileRoute } from "@tanstack/react-router";
import { addresses } from "@wherabouts.com/database/schema";
import { eq } from "drizzle-orm";
import { withApiKeyGET } from "../../../../lib/with-api-key";

export const Route = createFileRoute("/api/v1/addresses/$id")({
	server: {
		handlers: {
			GET: withApiKeyGET("addresses.byId", async ({ params, db }) => {
				const id = Number.parseInt(params.id, 10);
				if (Number.isNaN(id)) {
					return Response.json(
						{ error: "Invalid address ID" },
						{ status: 400 }
					);
				}

				const rows = await db
					.select()
					.from(addresses)
					.where(eq(addresses.id, id))
					.limit(1);

				if (rows.length === 0) {
					return Response.json({ error: "Address not found" }, { status: 404 });
				}

				const row = rows[0];
				return Response.json({
					id: row.id,
					country: row.country,
					state: row.state,
					locality: row.locality,
					postcode: row.postcode,
					streetName: row.streetName,
					streetType: row.streetType,
					streetSuffix: row.streetSuffix,
					buildingName: row.buildingName,
					flatType: row.flatType,
					flatNumber: row.flatNumber,
					levelType: row.levelType,
					levelNumber: row.levelNumber,
					numberFirst: row.numberFirst,
					numberLast: row.numberLast,
					longitude: row.longitude,
					latitude: row.latitude,
					confidence: row.confidence,
					gnafPid: row.gnafPid,
				});
			}),
		},
	},
});
