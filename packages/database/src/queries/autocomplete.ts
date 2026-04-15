import { sql } from "drizzle-orm";
import type { Database } from "../client.ts";

const TRIGRAM_SIMILARITY_THRESHOLD = 0.3;
const LEVENSHTEIN_SHORT_MAX_DISTANCE = 1;
const LEVENSHTEIN_LONG_MAX_DISTANCE = 2;
const PREFIX_SEARCH_MAX_LEN = 4;
const TRIGRAM_SEARCH_MIN_LEN = 5;
const WIDE_FUZZY_MIN_LEN = 8;

export interface AutocompleteResult {
	country: string;
	formattedAddress: string;
	id: number;
	latitude: number;
	locality: string;
	longitude: number;
	postcode: string;
	state: string;
	streetAddress: string;
}

interface RawAddressRow {
	id: number;
	country: string;
	state: string;
	locality: string;
	postcode: string;
	street_name: string;
	street_type: string | null;
	street_suffix: string | null;
	building_name: string | null;
	flat_type: string | null;
	flat_number: string | null;
	level_type: string | null;
	level_number: string | null;
	number_first: string | null;
	number_last: string | null;
	longitude: number;
	latitude: number;
	similarity_score: number;
}

function formatStreetAddress(row: {
	flatType: string | null;
	flatNumber: string | null;
	levelType: string | null;
	levelNumber: string | null;
	numberFirst: string | null;
	numberLast: string | null;
	streetName: string;
	streetType: string | null;
	streetSuffix: string | null;
	buildingName: string | null;
}): string {
	const parts: string[] = [];

	if (row.buildingName) {
		parts.push(row.buildingName);
	}

	if (row.flatType && row.flatNumber) {
		parts.push(`${row.flatType} ${row.flatNumber}`);
	} else if (row.flatNumber) {
		parts.push(`Unit ${row.flatNumber}`);
	}

	if (row.levelType && row.levelNumber) {
		parts.push(`${row.levelType} ${row.levelNumber}`);
	}

	const numberRange = row.numberLast
		? `${row.numberFirst}-${row.numberLast}`
		: row.numberFirst;

	const streetParts = [
		numberRange,
		row.streetName,
		row.streetType,
		row.streetSuffix,
	].filter(Boolean);

	parts.push(streetParts.join(" "));

	return parts.join(", ");
}

function buildFilterClauses(country?: string, state?: string): typeof sql[] {
	const clauses: (ReturnType<typeof sql>)[] = [];
	if (country) {
		clauses.push(sql`country = ${country.toUpperCase()}`);
	}
	if (state) {
		clauses.push(sql`state = ${state.toUpperCase()}`);
	}
	return clauses;
}

function buildWhereClause(
	searchCondition: ReturnType<typeof sql>,
	filterClauses: (ReturnType<typeof sql>)[]
): ReturnType<typeof sql> {
	const allConditions = [searchCondition, ...filterClauses];
	return sql.join(allConditions, sql` AND `);
}

function buildOrderBy(
	latitude?: number,
	longitude?: number,
	similarityColumn?: string
): ReturnType<typeof sql> {
	const orderParts: (ReturnType<typeof sql>)[] = [
		sql`population_score DESC`,
		sql`admin_level ASC`,
	];

	if (latitude !== undefined && longitude !== undefined) {
		orderParts.push(
			sql`ST_Distance(geom, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)) ASC`
		);
	}

	if (similarityColumn === "similarity_score") {
		orderParts.push(sql`similarity_score DESC`);
	}

	return sql.join(orderParts, sql`, `);
}

const SELECT_COLUMNS = sql`
	id, country, state, locality, postcode,
	street_name, street_type, street_suffix,
	building_name, flat_type, flat_number,
	level_type, level_number,
	number_first, number_last,
	longitude, latitude`;

function mapRowToResult(row: RawAddressRow): AutocompleteResult {
	const mapped = {
		flatType: row.flat_type,
		flatNumber: row.flat_number,
		levelType: row.level_type,
		levelNumber: row.level_number,
		numberFirst: row.number_first,
		numberLast: row.number_last,
		streetName: row.street_name,
		streetType: row.street_type,
		streetSuffix: row.street_suffix,
		buildingName: row.building_name,
	};
	const streetAddress = formatStreetAddress(mapped);
	return {
		id: row.id,
		formattedAddress: `${streetAddress}, ${row.locality} ${row.state} ${row.postcode}, ${row.country}`,
		streetAddress,
		locality: row.locality,
		state: row.state,
		postcode: row.postcode ?? "",
		country: row.country,
		longitude: row.longitude,
		latitude: row.latitude,
	};
}

export async function autocompleteAddresses(
	db: Database,
	query: string,
	options: {
		country?: string;
		state?: string;
		limit?: number;
		latitude?: number;
		longitude?: number;
	} = {}
): Promise<AutocompleteResult[]> {
	const { country, state, limit = 10, latitude, longitude } = options;
	const trimmed = query.trim();
	if (!trimmed) {
		return [];
	}

	const len = trimmed.length;

	// Tier 0: Too short -- return empty
	if (len < 3) {
		return [];
	}

	const filterClauses = buildFilterClauses(country, state);
	const orderBy = buildOrderBy(latitude, longitude, "similarity_score");

	// Tier 1 (3-4 chars): Prefix search only (uses B-tree text_pattern_ops index)
	if (len <= PREFIX_SEARCH_MAX_LEN) {
		const prefixPattern = `${trimmed}%`;
		const whereClause = buildWhereClause(
			sql`search_text LIKE ${prefixPattern}`,
			filterClauses
		);

		const result = await db.execute(sql`
			SELECT ${SELECT_COLUMNS}, 1.0 as similarity_score
			FROM addresses
			WHERE ${whereClause}
			ORDER BY ${buildOrderBy(latitude, longitude)}
			LIMIT ${limit}
		`);

		return (result.rows as unknown as RawAddressRow[]).map(mapRowToResult);
	}

	// Tier 2 (5-7 chars): Trigram similarity + levenshtein fallback
	if (len < WIDE_FUZZY_MIN_LEN) {
		// Set trigram similarity threshold
		await db.execute(
			sql`SELECT set_limit(${TRIGRAM_SIMILARITY_THRESHOLD})`
		);

		const whereClause = buildWhereClause(
			sql`search_text % ${trimmed}`,
			filterClauses
		);

		const result = await db.execute(sql`
			SELECT ${SELECT_COLUMNS},
				similarity(search_text, ${trimmed}) as similarity_score
			FROM addresses
			WHERE ${whereClause}
			ORDER BY ${orderBy}
			LIMIT ${limit}
		`);

		const rows = result.rows as unknown as RawAddressRow[];

		if (rows.length > 0) {
			return rows.map(mapRowToResult);
		}

		// Levenshtein fallback (distance <= 1)
		const levenshteinWhere = buildWhereClause(
			sql`levenshtein(lower(left(search_text, ${len + 2})), lower(${trimmed})) <= ${LEVENSHTEIN_SHORT_MAX_DISTANCE}`,
			filterClauses
		);

		const fallbackResult = await db.execute(sql`
			SELECT ${SELECT_COLUMNS}, 0.5 as similarity_score
			FROM addresses
			WHERE ${levenshteinWhere}
			ORDER BY ${buildOrderBy(latitude, longitude)}
			LIMIT ${limit}
		`);

		return (fallbackResult.rows as unknown as RawAddressRow[]).map(
			mapRowToResult
		);
	}

	// Tier 3 (8+ chars): Word similarity with wider fuzzy tolerance + phonetic fallback
	await db.execute(sql`SELECT set_limit(${TRIGRAM_SIMILARITY_THRESHOLD})`);

	const tier3Where = buildWhereClause(
		sql`search_text <%% ${trimmed}`,
		filterClauses
	);

	const result = await db.execute(sql`
		SELECT ${SELECT_COLUMNS},
			word_similarity(search_text, ${trimmed}) as similarity_score
		FROM addresses
		WHERE ${tier3Where}
		ORDER BY ${orderBy}
		LIMIT ${limit}
	`);

	const rows = result.rows as unknown as RawAddressRow[];

	if (rows.length > 0) {
		return rows.map(mapRowToResult);
	}

	// Levenshtein fallback (distance <= 2)
	const levenshteinWhere = buildWhereClause(
		sql`levenshtein(lower(left(search_text, ${len + 2})), lower(${trimmed})) <= ${LEVENSHTEIN_LONG_MAX_DISTANCE}`,
		filterClauses
	);

	const levenshteinResult = await db.execute(sql`
		SELECT ${SELECT_COLUMNS}, 0.5 as similarity_score
		FROM addresses
		WHERE ${levenshteinWhere}
		ORDER BY ${buildOrderBy(latitude, longitude)}
		LIMIT ${limit}
	`);

	const levenshteinRows =
		levenshteinResult.rows as unknown as RawAddressRow[];

	if (levenshteinRows.length > 0) {
		return levenshteinRows.map(mapRowToResult);
	}

	// Phonetic fallback (dmetaphone)
	const phoneticWhere = buildWhereClause(
		sql`dmetaphone(left(search_text, 20)) = dmetaphone(${trimmed})`,
		filterClauses
	);

	const phoneticResult = await db.execute(sql`
		SELECT ${SELECT_COLUMNS}, 0.3 as similarity_score
		FROM addresses
		WHERE ${phoneticWhere}
		ORDER BY ${buildOrderBy(latitude, longitude)}
		LIMIT ${limit}
	`);

	return (phoneticResult.rows as unknown as RawAddressRow[]).map(
		mapRowToResult
	);
}
