import { ORPCError } from "@orpc/server";
import { deviceZoneState, zones } from "@wherabouts.com/database/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { o as baseBuilder } from "../../builder.ts";
import {
	apiKeyAuth,
	usageMiddleware,
	type ValidatedApiKey,
} from "../public-middleware.ts";
import {
	computeBoundaryCrossings,
	type BoundaryCrossing,
} from "./boundary-crossings.ts";

export { computeBoundaryCrossings, type BoundaryCrossing };

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

type AuthContext = { validatedApiKey: ValidatedApiKey };

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

export const pushDeviceLocation = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("devices.location"))
	.route({
		method: "POST",
		path: "/api/v1/devices/{deviceId}/location",
		summary: "Push device location update",
		tags: ["devices"],
	})
	.input(
		z.object({
			deviceId: z.string().min(1).max(255),
			lat: z.number().min(-90).max(90),
			lng: z.number().min(-180).max(180),
		})
	)
	.handler(async ({ input, context }) => {
		const ctx = context as typeof context &
			AuthContext & {
				// biome-ignore lint/suspicious/noExplicitAny: Queue type from @cloudflare/workers-types not in this package's tsconfig
				env?: { WEBHOOK_DELIVERY_QUEUE?: any };
			};
		const projectId = requireProjectId(ctx.validatedApiKey.projectId);
		const { deviceId, lat, lng } = input;

		const point = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;

		// Current containing zones
		const containingZones = await context.db
			.select({ id: zones.id, name: zones.name })
			.from(zones)
			.where(
				and(
					eq(zones.projectId, projectId),
					sql`ST_Contains(${zones.geom}, ${point})`
				)
			);

		const currentZoneIds = containingZones.map((z) => z.id);
		const zoneNames: Record<number, string> = Object.fromEntries(
			containingZones.map((z) => [z.id, z.name])
		);

		// Previous state
		const [prevState] = await context.db
			.select({ zoneIds: deviceZoneState.zoneIds })
			.from(deviceZoneState)
			.where(
				and(
					eq(deviceZoneState.projectId, projectId),
					eq(deviceZoneState.deviceId, deviceId)
				)
			)
			.limit(1);

		const previousZoneIds = prevState?.zoneIds ?? [];
		const crossings = computeBoundaryCrossings(
			previousZoneIds,
			currentZoneIds,
			zoneNames
		);

		// Upsert device state — use parameterized ARRAY constructor to safely
		// handle both empty and non-empty arrays without sql.raw injection risk.
		const zoneIdsArray =
			currentZoneIds.length > 0
				? sql`ARRAY[${sql.join(
						currentZoneIds.map((id) => sql`${id}`),
						sql`, `
					)}]::integer[]`
				: sql`ARRAY[]::integer[]`;

		await context.db.execute(sql`
			INSERT INTO device_zone_state (project_id, device_id, zone_ids, latitude, longitude, updated_at)
			VALUES (${projectId}, ${deviceId}, ${zoneIdsArray}, ${lat}, ${lng}, now())
			ON CONFLICT (project_id, device_id)
			DO UPDATE SET
				zone_ids = EXCLUDED.zone_ids,
				latitude = EXCLUDED.latitude,
				longitude = EXCLUDED.longitude,
				updated_at = EXCLUDED.updated_at
		`);

		// Enqueue webhook delivery for each boundary crossing
		if (crossings.length > 0 && ctx.env?.WEBHOOK_DELIVERY_QUEUE) {
			for (const crossing of crossings) {
				await ctx.env.WEBHOOK_DELIVERY_QUEUE.send({
					type: "webhook-delivery",
					projectId,
					deviceId,
					lat,
					lng,
					zoneId: crossing.zoneId,
					zoneName: crossing.zoneName,
					event: crossing.event,
					timestamp: new Date().toISOString(),
				});
			}
		}

		return { zones: currentZoneIds, crossings };
	});

export const getDeviceZones = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("devices.zones"))
	.route({
		method: "GET",
		path: "/api/v1/devices/{deviceId}/zones",
		summary: "Current zone membership for a device",
		tags: ["devices"],
	})
	.input(z.object({ deviceId: z.string().min(1).max(255) }))
	.handler(async ({ input, context }) => {
		const ctx = context as typeof context & AuthContext;
		const projectId = requireProjectId(ctx.validatedApiKey.projectId);

		const [state] = await context.db
			.select()
			.from(deviceZoneState)
			.where(
				and(
					eq(deviceZoneState.projectId, projectId),
					eq(deviceZoneState.deviceId, input.deviceId)
				)
			)
			.limit(1);

		if (!state) {
			throw new ORPCError("NOT_FOUND", { message: "Device not found." });
		}

		return {
			deviceId: state.deviceId,
			zoneIds: state.zoneIds,
			latitude: state.latitude,
			longitude: state.longitude,
			updatedAt: state.updatedAt,
		};
	});
