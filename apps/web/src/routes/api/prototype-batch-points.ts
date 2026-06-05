// PROTOTYPE — throwaway data source for the mapcn batch-cluster-map prototype.
// Returns real AU GNAF coordinates from the `addresses` table as a GeoJSON
// FeatureCollection, standing in for "a completed batch geocode job's results".
// Read-only. Delete with the rest of the prototype.
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { getDb } from "../../lib/db";

const DEFAULT_COUNT = 5000;
const MAX_COUNT = 15_000;

export const Route = createFileRoute("/api/prototype-batch-points")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url);
				const requested = Number(url.searchParams.get("n") ?? DEFAULT_COUNT);
				const count = Math.min(
					Number.isFinite(requested) && requested > 0
						? requested
						: DEFAULT_COUNT,
					MAX_COUNT
				);

				// TABLESAMPLE SYSTEM is block-level and fast on the 16.8M-row table.
				const result = await getDb().execute(sql`
					SELECT longitude, latitude, state, postcode
					FROM addresses TABLESAMPLE SYSTEM (0.1)
					WHERE latitude IS NOT NULL AND longitude IS NOT NULL
					LIMIT ${count}
				`);

				const rows = (
					Array.isArray(result) ? result : (result as { rows: unknown[] }).rows
				) as Array<{
					longitude: number | string;
					latitude: number | string;
					state: string | null;
					postcode: string | null;
				}>;

				const features = rows.map((r) => ({
					type: "Feature" as const,
					geometry: {
						type: "Point" as const,
						coordinates: [Number(r.longitude), Number(r.latitude)],
					},
					properties: { state: r.state, postcode: r.postcode },
				}));

				return Response.json(
					{ type: "FeatureCollection", features },
					{ headers: { "cache-control": "no-store" } }
				);
			},
		},
	},
});
