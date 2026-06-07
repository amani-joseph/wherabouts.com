import { execFileSync } from "node:child_process";
import { argv, env, exit } from "node:process";

interface LayerSpec {
	/** Source field holding the official code. */
	codeField: string;
	/** Our `regions.layer` code. */
	layer: string;
	/** Source field holding the human name. */
	nameField: string;
	/** Path to the source GeoPackage/shapefile for this layer. */
	source: string;
	/** Source field holding the parent state abbreviation (or null). */
	stateField: string | null;
}

const GPKG_EXT_RE = /\.gpkg$/i;

// Field names follow ABS ASGS Edition 3 GeoPackage attribute schemas.
const LAYERS: Record<string, LayerSpec> = {
	state: {
		layer: "state",
		source: "data/asgs/STE_2021_AUST_GDA2020.gpkg",
		codeField: "STE_CODE21",
		nameField: "STE_NAME21",
		// The state layer is self-referential: a state row's parent state is itself.
		stateField: "STE_NAME21",
	},
	sa1: {
		layer: "sa1",
		source: "data/asgs/SA1_2021_AUST_GDA2020.gpkg",
		codeField: "SA1_CODE21",
		nameField: "SA1_CODE21",
		stateField: "STE_NAME21",
	},
	sa2: {
		layer: "sa2",
		source: "data/asgs/SA2_2021_AUST_GDA2020.gpkg",
		codeField: "SA2_CODE21",
		nameField: "SA2_NAME21",
		stateField: "STE_NAME21",
	},
	sa3: {
		layer: "sa3",
		source: "data/asgs/SA3_2021_AUST_GDA2020.gpkg",
		codeField: "SA3_CODE21",
		nameField: "SA3_NAME21",
		stateField: "STE_NAME21",
	},
	sa4: {
		layer: "sa4",
		source: "data/asgs/SA4_2021_AUST_GDA2020.gpkg",
		codeField: "SA4_CODE21",
		nameField: "SA4_NAME21",
		stateField: "STE_NAME21",
	},
	lga: {
		layer: "lga",
		source: "data/asgs/LGA_2021_AUST_GDA2020.gpkg",
		codeField: "LGA_CODE21",
		nameField: "LGA_NAME21",
		stateField: "STE_NAME21",
	},
	poa: {
		layer: "poa",
		source: "data/asgs/POA_2021_AUST_GDA2020.gpkg",
		codeField: "POA_CODE21",
		nameField: "POA_NAME21",
		stateField: null,
	},
	ced: {
		layer: "ced",
		source: "data/asgs/CED_2021_AUST_GDA2020.gpkg",
		codeField: "CED_CODE21",
		nameField: "CED_NAME21",
		stateField: "STE_NAME21",
	},
	sed: {
		layer: "sed",
		source: "data/asgs/SED_2021_AUST_GDA2020.gpkg",
		codeField: "SED_CODE21",
		nameField: "SED_NAME21",
		stateField: "STE_NAME21",
	},
	mb: {
		layer: "mb",
		source: "data/asgs/MB_2021_AUST_GDA2020.gpkg",
		codeField: "MB_CODE21",
		nameField: "MB_CODE21",
		stateField: "STE_NAME21",
	},
};

function layerNameFromSource(source: string): string {
	const file = source.split("/").pop() ?? source;
	return file.replace(GPKG_EXT_RE, "");
}

function ingestLayer(spec: LayerSpec, dbUrl: string): void {
	const stateExpr = spec.stateField ? spec.stateField : "NULL";
	// Select into our column shape, force MultiPolygon, reproject to EPSG:4326.
	const sql = `SELECT ${spec.codeField} AS code, ${spec.nameField} AS name, ${stateExpr} AS state, '${spec.layer}' AS layer FROM "${layerNameFromSource(spec.source)}"`;

	// Idempotent: clear this layer first.
	execFileSync(
		"psql",
		[dbUrl, "-c", `DELETE FROM regions WHERE layer = '${spec.layer}';`],
		{ stdio: "inherit" }
	);

	execFileSync(
		"ogr2ogr",
		[
			"-f",
			"PostgreSQL",
			`PG:${dbUrl}`,
			spec.source,
			"-nln",
			"regions",
			"-append",
			"-t_srs",
			"EPSG:4326",
			"-nlt",
			"MULTIPOLYGON",
			"-makevalid",
			"-dialect",
			"SQLITE",
			"-sql",
			sql,
			"-lco",
			"GEOMETRY_NAME=geom",
		],
		{ stdio: "inherit" }
	);
}

function main(): void {
	const dbUrl = env.DATABASE_URL;
	if (!dbUrl) {
		console.error("DATABASE_URL is required.");
		exit(1);
	}
	// Optional layer filter: `node ingest-asgs.ts sa2 lga` ingests a subset.
	const requested = argv.slice(2);
	const unknown = requested.filter((l) => !(l in LAYERS));
	if (unknown.length > 0) {
		console.warn(`Ignoring unknown layer(s): ${unknown.join(", ")}`);
	}
	const chosen =
		requested.length > 0
			? requested.filter((l) => l in LAYERS)
			: Object.keys(LAYERS);
	for (const key of chosen) {
		console.log(`Ingesting layer: ${key}`);
		ingestLayer(LAYERS[key], dbUrl);
	}
	console.log(`Done. Layers ingested: ${chosen.join(", ")}`);
}

main();
