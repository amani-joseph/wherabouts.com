import { createFileRoute } from "@tanstack/react-router";
import { addresses } from "@wherabouts.com/database/schema";
import { and, sql } from "drizzle-orm";
import { withApiKeyGET } from "../../../../lib/with-api-key";

export const Route = createFileRoute("/api/v1/addresses/nearby")({
	server: {
		handlers: {
			GET: withApiKeyGET("addresses.nearby", async ({ request, db }) => {
				const url = new URL(request.url);
				const lat = Number.parseFloat(url.searchParams.get("lat") ?? "");
				const lng = Number.parseFloat(url.searchParams.get("lng") ?? "");
				const radiusParam = url.searchParams.get("radius");
				const radius = radiusParam
					? Math.min(Number.parseFloat(radiusParam), 50_000)
					: 1000;
				const limitParam = url.searchParams.get("limit");
				const limit = limitParam
					? Math.min(Number.parseInt(limitParam, 10), 50)
					: 10;
				const country = url.searchParams.get("country") ?? undefined;

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

				const filters = [sql`ST_DWithin(${geomGeo}, ${point}, ${radius})`];
				if (country) {
					filters.push(sql`${addresses.country} = ${country.toUpperCase()}`);
				}

				const rows = await db
					.select({
						id: addresses.id,
						country: addresses.country,
						state: addresses.state,
						locality: addresses.locality,
						postcode: addresses.postcode,
						streetName: addresses.streetName,
						streetType: addresses.streetType,
						numberFirst: addresses.numberFirst,
						numberLast: addresses.numberLast,
						buildingName: addresses.buildingName,
						flatType: addresses.flatType,
						flatNumber: addresses.flatNumber,
						longitude: addresses.longitude,
						latitude: addresses.latitude,
						distance: sql<number>`ST_Distance(${geomGeo}, ${point})`.as(
							"distance"
						),
					})
					.from(addresses)
					.where(and(...filters))
					.orderBy(sql`ST_Distance(${geomGeo}, ${point})`)
					.limit(limit);

				return Response.json({
					results: rows.map((row) => ({
						...row,
						distance: Math.round(row.distance),
					})),
					count: rows.length,
					query: { lat, lng, radius },
				});
			}),
		},
	},
});
