import {
	customType,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects } from "./projects.ts";

const polygon = customType<{ data: string }>({
	dataType() {
		return "geometry(Polygon, 4326)";
	},
});

export const zones = pgTable(
	"zones",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		name: varchar({ length: 255 }).notNull(),
		description: text(),
		geom: polygon("geom").notNull(),
		metadata: jsonb(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_zones_project_id").on(table.projectId),
		index("idx_zones_geom").using("gist", table.geom),
	]
);

export const deviceZoneState = pgTable(
	"device_zone_state",
	{
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		deviceId: varchar("device_id", { length: 255 }).notNull(),
		zoneIds: integer("zone_ids")
			.array()
			.notNull()
			.default(sql`'{}'::integer[]`),
		latitude: doublePrecision("latitude").notNull(),
		longitude: doublePrecision("longitude").notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.projectId, table.deviceId] }),
	]
);

export type Zone = typeof zones.$inferSelect;
export type NewZone = typeof zones.$inferInsert;
export type DeviceZoneState = typeof deviceZoneState.$inferSelect;
