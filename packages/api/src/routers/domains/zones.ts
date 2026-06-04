import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../procedures.ts";
import { requireProjectOwnership } from "../../shared/project-ownership.ts";
import {
	addressesInZone,
	countZones,
	deleteZoneRow,
	getZoneWithGeometry,
	insertZone,
	isValidPolygon,
	listZonesWithGeometry,
	updateZoneRow,
	ZONE_LIMIT,
	zonesContainingPoint,
} from "../../shared/zone-queries.ts";
import { geoJsonPolygonSchema } from "../public/zones-schema.ts";

const projectIdInput = z.object({ projectId: z.string().uuid() });

export const zonesRouter = {
	list: protectedProcedure
		.input(projectIdInput)
		.handler(async ({ context, input }) => {
			const projectId = await requireProjectOwnership(
				context.db,
				input.projectId,
				context.session.user.id
			);
			const zones = await listZonesWithGeometry(context.db, projectId);
			return { zones, count: zones.length };
		}),

	get: protectedProcedure
		.input(projectIdInput.extend({ id: z.number().int().min(1) }))
		.handler(async ({ context, input }) => {
			const projectId = await requireProjectOwnership(
				context.db,
				input.projectId,
				context.session.user.id
			);
			const zone = await getZoneWithGeometry(context.db, projectId, input.id);
			if (!zone) {
				throw new ORPCError("NOT_FOUND", { message: "Zone not found." });
			}
			return zone;
		}),

	create: protectedProcedure
		.input(
			projectIdInput.extend({
				name: z.string().min(1).max(255),
				description: z.string().optional(),
				geometry: geoJsonPolygonSchema,
				metadata: z.record(z.string(), z.unknown()).optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const projectId = await requireProjectOwnership(
				context.db,
				input.projectId,
				context.session.user.id
			);
			if ((await countZones(context.db, projectId)) >= ZONE_LIMIT) {
				throw new ORPCError("FORBIDDEN", {
					message:
						"Zone limit reached (500). Delete unused zones to create new ones.",
				});
			}
			if (!(await isValidPolygon(context.db, input.geometry))) {
				throw new ORPCError("UNPROCESSABLE_CONTENT", {
					message: "Provided geometry is not a valid polygon.",
				});
			}
			return await insertZone(context.db, projectId, {
				name: input.name,
				description: input.description,
				geometry: input.geometry,
				metadata: input.metadata,
			});
		}),

	update: protectedProcedure
		.input(
			projectIdInput.extend({
				id: z.number().int().min(1),
				name: z.string().min(1).max(255).optional(),
				description: z.string().optional(),
				geometry: geoJsonPolygonSchema.optional(),
				metadata: z.record(z.string(), z.unknown()).optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const projectId = await requireProjectOwnership(
				context.db,
				input.projectId,
				context.session.user.id
			);
			if (input.geometry && !(await isValidPolygon(context.db, input.geometry))) {
				throw new ORPCError("UNPROCESSABLE_CONTENT", {
					message: "Provided geometry is not a valid polygon.",
				});
			}
			const updated = await updateZoneRow(context.db, projectId, input.id, {
				name: input.name,
				description: input.description,
				geometry: input.geometry,
				metadata: input.metadata,
			});
			if (!updated) {
				throw new ORPCError("NOT_FOUND", { message: "Zone not found." });
			}
			return { success: true };
		}),

	delete: protectedProcedure
		.input(projectIdInput.extend({ id: z.number().int().min(1) }))
		.handler(async ({ context, input }) => {
			const projectId = await requireProjectOwnership(
				context.db,
				input.projectId,
				context.session.user.id
			);
			const deleted = await deleteZoneRow(context.db, projectId, input.id);
			if (!deleted) {
				throw new ORPCError("NOT_FOUND", { message: "Zone not found." });
			}
			return { success: true };
		}),

	contains: protectedProcedure
		.input(
			projectIdInput.extend({
				lat: z.number().min(-90).max(90),
				lng: z.number().min(-180).max(180),
			})
		)
		.handler(async ({ context, input }) => {
			const projectId = await requireProjectOwnership(
				context.db,
				input.projectId,
				context.session.user.id
			);
			const zones = await zonesContainingPoint(
				context.db,
				projectId,
				input.lat,
				input.lng
			);
			return {
				zones,
				count: zones.length,
				query: { lat: input.lat, lng: input.lng },
			};
		}),

	addresses: protectedProcedure
		.input(
			projectIdInput.extend({
				id: z.number().int().min(1),
				page: z.number().int().min(1).default(1),
				limit: z.number().int().min(1).max(500).default(50),
			})
		)
		.handler(async ({ context, input }) => {
			const projectId = await requireProjectOwnership(
				context.db,
				input.projectId,
				context.session.user.id
			);
			const zone = await getZoneWithGeometry(context.db, projectId, input.id);
			if (!zone) {
				throw new ORPCError("NOT_FOUND", { message: "Zone not found." });
			}
			const out = await addressesInZone(
				context.db,
				projectId,
				input.id,
				input.page,
				input.limit
			);
			return {
				...out,
				query: { id: input.id, page: input.page, limit: input.limit },
			};
		}),
};
