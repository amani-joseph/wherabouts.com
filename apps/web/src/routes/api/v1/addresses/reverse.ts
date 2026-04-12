import { createFileRoute } from "@tanstack/react-router";
import { addresses } from "@wherabouts.com/database/schema";
import { sql } from "drizzle-orm";
import { withApiKeyGET } from "../../../../lib/with-api-key";

export const Route = createFileRoute("/api/v1/addresses/reverse")({
	server: {
		handlers: {
			GET: withApiKeyGET("addresses.reverse", async ({ request, db }) => {
				const url = new URL(request.url);
				const lat = Number.parseFloat(url.searchParams.get("lat") ?? "");
				const lng = Number.parseFloat(url.searchParams.get("lng") ?? "");

				if (Number.isNaN(lat) || Number.isNaN(lng)) {
					return Response.json(
						{ error: "Valid 'lat' and 'lng' parameters are required" },
						{ status: 400 }
					);
				}

				if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
					return Response.json(
						{ error: "Coordinates out of range" },
						{ status: 400 }
					);
				}

				const point = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
				const geomGeo = sql`${addresses.geom}::geography`;

				// Find the closest address within 200m
				const rows = await db
					.select({
						id: addresses.id,
						country: addresses.country,
						state: addresses.state,
						locality: addresses.locality,
						postcode: addresses.postcode,
						streetName: addresses.streetName,
						streetType: addresses.streetType,
						streetSuffix: addresses.streetSuffix,
						numberFirst: addresses.numberFirst,
						numberLast: addresses.numberLast,
						buildingName: addresses.buildingName,
						flatType: addresses.flatType,
						flatNumber: addresses.flatNumber,
						levelType: addresses.levelType,
						levelNumber: addresses.levelNumber,
						longitude: addresses.longitude,
						latitude: addresses.latitude,
						confidence: addresses.confidence,
						gnafPid: addresses.gnafPid,
						distance: sql<number>`ST_Distance(${geomGeo}, ${point})`.as(
							"distance"
						),
					})
					.from(addresses)
					.where(sql`ST_DWithin(${geomGeo}, ${point}, 200)`)
					.orderBy(sql`ST_Distance(${geomGeo}, ${point})`)
					.limit(1);

				if (rows.length === 0) {
					return Response.json(
						{ error: "No address found within 200m of the given coordinates" },
						{ status: 404 }
					);
				}

				const row = rows[0];
				const numberRange = row.numberLast
					? `${row.numberFirst}-${row.numberLast}`
					: row.numberFirst;
				const streetParts = [
					numberRange,
					row.streetName,
					row.streetType,
					row.streetSuffix,
				].filter(Boolean);

				return Response.json({
					address: {
						id: row.id,
						formattedAddress: `${streetParts.join(" ")}, ${row.locality} ${row.state} ${row.postcode}, ${row.country}`,
						streetAddress: streetParts.join(" "),
						locality: row.locality,
						state: row.state,
						postcode: row.postcode,
						country: row.country,
						longitude: row.longitude,
						latitude: row.latitude,
						confidence: row.confidence,
					},
					distance: Math.round(row.distance),
					query: { lat, lng },
				});
			}),
		},
	},
});
