import { ORPCError } from "@orpc/server";
import { addresses, zones } from "@wherabouts.com/database/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { o as baseBuilder } from "../../builder.ts";
import {
	apiKeyAuth,
	usageMiddleware,
	type ValidatedApiKey,
} from "../public-middleware.ts";
import {
	geoJsonPolygonSchema,
	type GeoJsonPolygon,
} from "./zones-schema.ts";

export { geoJsonPolygonSchema, type GeoJsonPolygon };

// ---------------------------------------------------------------------------
// Helper: cast context to include validatedApiKey
// ---------------------------------------------------------------------------

type AuthContext = { validatedApiKey: ValidatedApiKey };

/** Assert projectId is non-null (all project-scoped API keys must have one). */
function requireProjectId(projectId: string | null): string {
	if (!projectId) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "This API key is not scoped to a project.",
		});
	}
	return projectId;
}

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

export const zoneCreate = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("zones.create"))
	.route({
		method: "POST",
		path: "/api/v1/zones",
		summary: "Create a zone",
		tags: ["zones"],
	})
	.input(
		z.object({
			name: z.string().min(1).max(255),
			description: z.string().optional(),
			geometry: geoJsonPolygonSchema,
			metadata: z.record(z.string(), z.unknown()).optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const ctx = context as typeof context & AuthContext;
		const projectId = requireProjectId(ctx.validatedApiKey.projectId);

		// Zone limit check
		const countResult = await context.db
			.select({ count: sql<number>`count(*)::int` })
			.from(zones)
			.where(eq(zones.projectId, projectId));
		const count = countResult[0]?.count ?? 0;
		if (count >= 500) {
			throw new ORPCError("FORBIDDEN", {
				message: "Zone limit reached (500). Delete unused zones to create new ones.",
			});
		}

		// Polygon validation
		const geomJson = JSON.stringify(input.geometry);
		const validResult = await context.db.execute(
			sql`SELECT ST_IsValid(ST_GeomFromGeoJSON(${geomJson})) AS valid`
		);
		const isValid = (
			validResult.rows[0] as { valid: boolean } | undefined
		)?.valid;
		if (!isValid) {
			throw new ORPCError("UNPROCESSABLE_CONTENT", {
				message: "Provided geometry is not a valid polygon.",
			});
		}

		const insertValues = {
			projectId,
			name: input.name,
			// biome-ignore lint/suspicious/noExplicitAny: SQL expression for geometry column
			geom: sql`ST_GeomFromGeoJSON(${geomJson})` as any,
			...(input.description !== undefined && {
				description: input.description,
			}),
			...(input.metadata !== undefined && { metadata: input.metadata }),
		};

		const inserted = await context.db
			.insert(zones)
			.values(insertValues)
			.returning({
				id: zones.id,
				projectId: zones.projectId,
				name: zones.name,
				description: zones.description,
				metadata: zones.metadata,
				createdAt: zones.createdAt,
				updatedAt: zones.updatedAt,
			});

		const row = inserted[0];
		if (!row) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create zone.",
			});
		}

		return row;
	});

export const zoneList = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("zones.list"))
	.route({
		method: "GET",
		path: "/api/v1/zones",
		summary: "List zones",
		tags: ["zones"],
	})
	.input(
		z.object({
			page: z.coerce.number().int().min(1).default(1),
			limit: z.coerce.number().int().min(1).max(100).default(20),
		})
	)
	.handler(async ({ input, context }) => {
		const ctx = context as typeof context & AuthContext;
		const projectId = requireProjectId(ctx.validatedApiKey.projectId);

		const offset = (input.page - 1) * input.limit;

		const rows = await context.db
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
			.limit(input.limit)
			.offset(offset);

		return { zones: rows, count: rows.length, page: input.page };
	});

export const zoneGet = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("zones.get"))
	.route({
		method: "GET",
		path: "/api/v1/zones/{id}",
		summary: "Get a zone by ID",
		tags: ["zones"],
	})
	.input(z.object({ id: z.coerce.number().int().min(1) }))
	.handler(async ({ input, context }) => {
		const ctx = context as typeof context & AuthContext;
		const projectId = requireProjectId(ctx.validatedApiKey.projectId);

		const rows = await context.db.execute(
			sql`SELECT id,
			           project_id AS "projectId",
			           name,
			           description,
			           metadata,
			           ST_AsGeoJSON(geom)::json AS geometry,
			           created_at AS "createdAt",
			           updated_at AS "updatedAt"
			    FROM zones
			    WHERE id = ${input.id} AND project_id = ${projectId}
			    LIMIT 1`
		);

		if (rows.rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Zone not found." });
		}

		return rows.rows[0] as {
			id: number;
			projectId: string;
			name: string;
			description: string | null;
			metadata: Record<string, unknown> | null;
			geometry: GeoJsonPolygon;
			createdAt: string;
			updatedAt: string;
		};
	});

export const zoneUpdate = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("zones.update"))
	.route({
		method: "PUT",
		path: "/api/v1/zones/{id}",
		summary: "Update a zone",
		tags: ["zones"],
	})
	.input(
		z.object({
			id: z.coerce.number().int().min(1),
			name: z.string().min(1).max(255).optional(),
			description: z.string().optional(),
			geometry: geoJsonPolygonSchema.optional(),
			metadata: z.record(z.string(), z.unknown()).optional(),
		})
	)
	.handler(async ({ input, context }) => {
		const ctx = context as typeof context & AuthContext;
		const projectId = requireProjectId(ctx.validatedApiKey.projectId);

		// Verify ownership
		const existing = await context.db
			.select({ id: zones.id })
			.from(zones)
			.where(and(eq(zones.id, input.id), eq(zones.projectId, projectId)))
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Zone not found." });
		}

		if (input.geometry) {
			const geomJson = JSON.stringify(input.geometry);

			// Validate new geometry
			const validResult = await context.db.execute(
				sql`SELECT ST_IsValid(ST_GeomFromGeoJSON(${geomJson})) AS valid`
			);
			const isValid = (
				validResult.rows[0] as { valid: boolean } | undefined
			)?.valid;
			if (!isValid) {
				throw new ORPCError("UNPROCESSABLE_CONTENT", {
					message: "Provided geometry is not a valid polygon.",
				});
			}

			// Use raw SQL update to handle geometry column
			const updated = await context.db.execute(
				sql`UPDATE zones SET
					name = COALESCE(${input.name ?? null}::varchar, name),
					description = CASE WHEN ${input.description !== undefined}::boolean THEN ${input.description ?? null}::text ELSE description END,
					geom = ST_GeomFromGeoJSON(${geomJson}),
					metadata = CASE WHEN ${input.metadata !== undefined}::boolean THEN ${input.metadata !== undefined ? JSON.stringify(input.metadata) : null}::jsonb ELSE metadata END,
					updated_at = NOW()
				WHERE id = ${input.id} AND project_id = ${projectId}
				RETURNING id,
				          project_id AS "projectId",
				          name,
				          description,
				          metadata,
				          created_at AS "createdAt",
				          updated_at AS "updatedAt"`
			);
			const row = updated.rows[0];
			if (!row) {
				throw new ORPCError("NOT_FOUND", { message: "Zone not found." });
			}
			return row as {
				id: number;
				projectId: string;
				name: string;
				description: string | null;
				metadata: Record<string, unknown> | null;
				createdAt: string;
				updatedAt: string;
			};
		}

		const updateSet: Record<string, unknown> = { updatedAt: new Date() };
		if (input.name !== undefined) updateSet.name = input.name;
		if (input.description !== undefined)
			updateSet.description = input.description;
		if (input.metadata !== undefined) updateSet.metadata = input.metadata;

		const updated = await context.db
			.update(zones)
			.set(updateSet)
			.where(and(eq(zones.id, input.id), eq(zones.projectId, projectId)))
			.returning({
				id: zones.id,
				projectId: zones.projectId,
				name: zones.name,
				description: zones.description,
				metadata: zones.metadata,
				createdAt: zones.createdAt,
				updatedAt: zones.updatedAt,
			});

		const row = updated[0];
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Zone not found." });
		}

		return row;
	});

export const zoneDelete = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("zones.delete"))
	.route({
		method: "DELETE",
		path: "/api/v1/zones/{id}",
		summary: "Delete a zone",
		tags: ["zones"],
	})
	.input(z.object({ id: z.coerce.number().int().min(1) }))
	.handler(async ({ input, context }) => {
		const ctx = context as typeof context & AuthContext;
		const projectId = requireProjectId(ctx.validatedApiKey.projectId);

		const deleted = await context.db
			.delete(zones)
			.where(and(eq(zones.id, input.id), eq(zones.projectId, projectId)))
			.returning({ id: zones.id });

		if (deleted.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Zone not found." });
		}

		return { success: true };
	});

export const zoneContains = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("zones.contains"))
	.route({
		method: "GET",
		path: "/api/v1/zones/contains",
		summary: "Find zones containing a point",
		tags: ["zones"],
	})
	.input(
		z.object({
			lat: z.number().min(-90).max(90),
			lng: z.number().min(-180).max(180),
		})
	)
	.handler(async ({ input, context }) => {
		const ctx = context as typeof context & AuthContext;
		const projectId = requireProjectId(ctx.validatedApiKey.projectId);
		const { lat, lng } = input;

		const rows = await context.db
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
					sql`ST_Contains(${zones.geom}, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))`
				)
			);

		return { zones: rows, count: rows.length, query: { lat, lng } };
	});

export const zoneAddresses = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("zones.addresses"))
	.route({
		method: "GET",
		path: "/api/v1/zones/{id}/addresses",
		summary: "Get addresses within a zone",
		tags: ["zones"],
	})
	.input(
		z.object({
			id: z.coerce.number().int().min(1),
			page: z.coerce.number().int().min(1).default(1),
			limit: z.coerce.number().int().min(1).max(500).default(50),
		})
	)
	.handler(async ({ input, context }) => {
		const ctx = context as typeof context & AuthContext;
		const projectId = requireProjectId(ctx.validatedApiKey.projectId);
		const { id, page, limit } = input;

		// Verify zone ownership
		const zoneRows = await context.db
			.select({ id: zones.id })
			.from(zones)
			.where(and(eq(zones.id, id), eq(zones.projectId, projectId)))
			.limit(1);

		if (zoneRows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Zone not found." });
		}

		const HARD_CAP = 10_000;
		const offset = (page - 1) * limit;

		// If paging beyond cap, return empty with truncated flag
		if (offset >= HARD_CAP) {
			return {
				results: [],
				count: 0,
				truncated: true,
				query: { id, page, limit },
			};
		}

		// Clamp so we never return beyond the hard cap
		const effectiveLimit = Math.min(limit, HARD_CAP - offset);

		const rows = await context.db
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
			})
			.from(addresses)
			.innerJoin(zones, sql`ST_Within(${addresses.geom}, ${zones.geom})`)
			.where(and(eq(zones.id, id), eq(zones.projectId, projectId)))
			.limit(effectiveLimit)
			.offset(offset);

		const truncated = offset + rows.length >= HARD_CAP;

		return {
			results: rows,
			count: rows.length,
			truncated,
			query: { id, page, limit },
		};
	});
