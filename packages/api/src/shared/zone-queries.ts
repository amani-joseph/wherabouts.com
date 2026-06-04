import type { Database } from "@wherabouts.com/database";
import { zones } from "@wherabouts.com/database/schema";
import { and, eq, sql } from "drizzle-orm";
import type { GeoJsonPolygon } from "../routers/public/zones-schema.ts";

export const ZONE_LIMIT = 500;

export async function countZones(
	db: Database,
	projectId: string
): Promise<number> {
	const rows = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(zones)
		.where(eq(zones.projectId, projectId));
	return rows[0]?.count ?? 0;
}

export async function isValidPolygon(
	db: Database,
	geometry: GeoJsonPolygon
): Promise<boolean> {
	const geomJson = JSON.stringify(geometry);
	const result = await db.execute(
		sql`SELECT ST_IsValid(ST_GeomFromGeoJSON(${geomJson})) AS valid`
	);
	return Boolean((result.rows[0] as { valid: boolean } | undefined)?.valid);
}

export interface ZoneRow {
	id: number;
	projectId: string;
	name: string;
	description: string | null;
	metadata: unknown;
	createdAt: Date;
	updatedAt: Date;
}

export async function insertZone(
	db: Database,
	projectId: string,
	input: {
		name: string;
		description?: string;
		geometry: GeoJsonPolygon;
		metadata?: Record<string, unknown>;
	}
): Promise<ZoneRow> {
	const geomJson = JSON.stringify(input.geometry);
	const [row] = await db
		.insert(zones)
		.values({
			projectId,
			name: input.name,
			// biome-ignore lint/suspicious/noExplicitAny: SQL expression for geometry column
			geom: sql`ST_GeomFromGeoJSON(${geomJson})` as any,
			...(input.description !== undefined && { description: input.description }),
			...(input.metadata !== undefined && { metadata: input.metadata }),
		})
		.returning({
			id: zones.id,
			projectId: zones.projectId,
			name: zones.name,
			description: zones.description,
			metadata: zones.metadata,
			createdAt: zones.createdAt,
			updatedAt: zones.updatedAt,
		});
	return row as ZoneRow;
}

export async function listZoneRows(
	db: Database,
	projectId: string,
	limit: number,
	offset: number
): Promise<ZoneRow[]> {
	return (await db
		.select({
			id: zones.id,
			projectId: zones.projectId,
			name: zones.name,
			description: zones.description,
			metadata: zones.metadata,
			createdAt: zones.createdAt,
			updatedAt: zones.updatedAt,
		})
		.from(zones)
		.where(eq(zones.projectId, projectId))
		.limit(limit)
		.offset(offset)) as ZoneRow[];
}

export async function zonesContainingPoint(
	db: Database,
	projectId: string,
	lat: number,
	lng: number
): Promise<ZoneRow[]> {
	const point = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
	return (await db
		.select({
			id: zones.id,
			projectId: zones.projectId,
			name: zones.name,
			description: zones.description,
			metadata: zones.metadata,
			createdAt: zones.createdAt,
			updatedAt: zones.updatedAt,
		})
		.from(zones)
		.where(
			and(
				eq(zones.projectId, projectId),
				sql`ST_Contains(${zones.geom}, ${point})`
			)
		)) as ZoneRow[];
}

export async function deleteZoneRow(
	db: Database,
	projectId: string,
	zoneId: number
): Promise<boolean> {
	const deleted = await db
		.delete(zones)
		.where(and(eq(zones.id, zoneId), eq(zones.projectId, projectId)))
		.returning({ id: zones.id });
	return deleted.length > 0;
}
