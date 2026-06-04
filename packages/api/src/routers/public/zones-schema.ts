import { z } from "zod";

export const geoJsonPolygonSchema = z.object({
	type: z.literal("Polygon"),
	coordinates: z
		.array(z.array(z.tuple([z.number(), z.number()])))
		.min(1, "Polygon coordinates must not be empty"),
});

export type GeoJsonPolygon = z.infer<typeof geoJsonPolygonSchema>;
