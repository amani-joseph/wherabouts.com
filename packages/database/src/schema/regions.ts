import {
	customType,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	varchar,
} from "drizzle-orm/pg-core";

const multiPolygon = customType<{ data: string }>({
	dataType() {
		return "geometry(MultiPolygon, 4326)";
	},
});

// Static, bulk-loaded ASGS reference data — intentionally no audit timestamps.
export const regions = pgTable(
	"regions",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		// One of: state, sa1, sa2, sa3, sa4, lga, poa, ced, sed, mb
		layer: varchar({ length: 8 }).notNull(),
		code: varchar({ length: 32 }).notNull(),
		name: text().notNull(),
		// Full ASGS state name (e.g. "New South Wales"), so text() not varchar.
		// Nullable on purpose: the `state` layer is itself a state, and POA
		// (postcode) boundaries have no single parent state in ASGS.
		state: text(),
		attrs: jsonb(),
		geom: multiPolygon("geom").notNull(),
	},
	(table) => [
		// GiST powers the ST_Covers point-in-polygon classification query.
		index("idx_regions_geom").using("gist", table.geom),
		// Layer-leading btree serves the ingestion DELETE ... WHERE layer = $1.
		// `code` is never a query predicate, so no index includes it.
		index("idx_regions_layer").on(table.layer),
	]
);

export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;
