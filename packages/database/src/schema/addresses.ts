import { sql } from "drizzle-orm";
import {
	customType,
	index,
	integer,
	pgTable,
	real,
	text,
	varchar,
} from "drizzle-orm/pg-core";

const geometry = customType<{ data: string }>({
	dataType() {
		return "geometry(Point, 4326)";
	},
});

export const addresses = pgTable(
	"addresses",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		country: varchar({ length: 2 }).notNull(),
		state: varchar({ length: 10 }).notNull(),
		locality: text().notNull(),
		postcode: varchar({ length: 10 }).notNull(),
		streetName: text("street_name").notNull(),
		streetType: varchar("street_type", { length: 20 }),
		streetSuffix: varchar("street_suffix", { length: 10 }),
		buildingName: text("building_name"),
		flatType: varchar("flat_type", { length: 10 }),
		flatNumber: varchar("flat_number", { length: 10 }),
		levelType: varchar("level_type", { length: 10 }),
		levelNumber: varchar("level_number", { length: 10 }),
		numberFirst: varchar("number_first", { length: 15 }),
		numberLast: varchar("number_last", { length: 15 }),
		longitude: real().notNull(),
		latitude: real().notNull(),
		confidence: integer(),
		gnafPid: varchar("gnaf_pid", { length: 30 }),
		geom: geometry("geom"),
	},
	(table) => [
		index("idx_addresses_country").on(table.country),
		index("idx_addresses_state").on(table.country, table.state),
		index("idx_addresses_postcode").on(table.postcode),
		index("idx_addresses_locality").on(
			table.country,
			table.state,
			table.locality
		),
		index("idx_addresses_street").on(table.locality, table.streetName),
		index("idx_addresses_gnaf_pid").on(table.gnafPid),
	]
);

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
