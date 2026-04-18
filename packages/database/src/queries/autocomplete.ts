import { type SQL, sql } from "drizzle-orm";
import type { Database } from "../client.ts";
import {
	type ParsedUnitAddress,
	parseUnitAddress,
} from "./parse-unit-address.ts";

const TRIGRAM_SIMILARITY_THRESHOLD = 0.3;
const LEVENSHTEIN_SHORT_MAX_DISTANCE = 1;
const LEVENSHTEIN_LONG_MAX_DISTANCE = 2;
const PREFIX_SEARCH_MAX_LEN = 4;
const WIDE_FUZZY_MIN_LEN = 8;
const PURE_DIGITS_REGEX = /^\d+$/;

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
	building_name: string | null;
	country: string;
	flat_number: string | null;
	flat_type: string | null;
	id: number;
	latitude: number;
	level_number: string | null;
	level_type: string | null;
	locality: string;
	longitude: number;
	number_first: string | null;
	number_last: string | null;
	postcode: string;
	similarity_score: number;
	state: string;
	street_name: string;
	street_suffix: string | null;
	street_type: string | null;
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

function buildFilterClauses(
	country?: string,
	state?: string,
	parsed?: ParsedUnitAddress | null
): SQL<unknown>[] {
	const clauses: SQL<unknown>[] = [];
	if (country) {
		clauses.push(sql`country = ${country.toUpperCase()}`);
	}
	if (state) {
		clauses.push(sql`state = ${state.toUpperCase()}`);
	}
	if (parsed) {
		const digitRange =
			parsed.unitNumberLast &&
			PURE_DIGITS_REGEX.test(parsed.unitNumber) &&
			PURE_DIGITS_REGEX.test(parsed.unitNumberLast);
		if (digitRange) {
			clauses.push(
				sql`flat_number ~ '^[0-9]+$' AND flat_number::int BETWEEN ${Number(parsed.unitNumber)} AND ${Number(parsed.unitNumberLast)}`
			);
		} else {
			clauses.push(sql`upper(flat_number) = upper(${parsed.unitNumber}::text)`);
		}
		clauses.push(
			sql`upper(number_first) = upper(${parsed.streetNumber}::text)`
		);
		if (parsed.levelNumber) {
			clauses.push(
				sql`upper(level_number) = upper(${parsed.levelNumber}::text)`
			);
		}
	}
	return clauses;
}

function buildWhereClause(
	searchCondition: SQL<unknown>,
	filterClauses: SQL<unknown>[]
): SQL<unknown> {
	const allConditions = [searchCondition, ...filterClauses];
	return sql.join(allConditions, sql` AND `);
}

function buildOrderBy(
	latitude?: number,
	longitude?: number,
	similarityColumn?: string,
	useRankingColumns = false
): SQL<unknown> {
	const orderParts: SQL<unknown>[] = [];

	if (useRankingColumns) {
		orderParts.push(sql`population_score DESC`, sql`admin_level ASC`);
	}

	if (latitude !== undefined && longitude !== undefined) {
		orderParts.push(
			sql`ST_Distance(geom, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)) ASC`
		);
	}

	if (similarityColumn === "similarity_score") {
		orderParts.push(sql`similarity_score DESC`);
	}

	if (orderParts.length === 0) {
		orderParts.push(sql`1`);
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
): Promise<{
	results: AutocompleteResult[];
	parsedQuery: ParsedUnitAddress | null;
}> {
	const { country, state, limit = 10, latitude, longitude } = options;
	const trimmed = query.trim();
	if (!trimmed) {
		return { results: [], parsedQuery: null };
	}

	const parsed = parseUnitAddress(trimmed);
	const searchInput = parsed ? parsed.streetQuery : trimmed;
	const len = searchInput.length;

	// Too short -- only guard when parser did not strip unit/street numbers;
	// when parsed, the strict unit + street_number filters narrow results enough.
	if (!parsed && len < 3) {
		return { results: [], parsedQuery: null };
	}

	const filterClauses = buildFilterClauses(country, state, parsed);

	// Parsed with empty streetQuery -- filters alone identify the rows.
	if (parsed && searchInput === "") {
		const whereClause = sql.join(filterClauses, sql` AND `);
		const result = await db.execute(sql`
			SELECT ${SELECT_COLUMNS}, 1.0 as similarity_score
			FROM addresses
			WHERE ${whereClause}
			ORDER BY ${buildOrderBy(latitude, longitude)}
			LIMIT ${limit}
		`);
		return {
			results: (result.rows as unknown as RawAddressRow[]).map(mapRowToResult),
			parsedQuery: parsed,
		};
	}

	// Always try fast prefix search first (uses B-tree index, works without extensions)
	const prefixResults = await prefixSearch(db, searchInput, filterClauses, {
		limit,
		latitude,
		longitude,
	});
	if (prefixResults.length > 0) {
		return { results: prefixResults, parsedQuery: parsed };
	}

	// Try tiered fuzzy search (requires pg_trgm + fuzzystrmatch extensions)
	// Falls back to optimized ILIKE if extensions aren't available
	let results: AutocompleteResult[];
	try {
		results = await tieredSearch(db, searchInput, len, filterClauses, {
			limit,
			latitude,
			longitude,
		});
	} catch {
		results = await ilikeFallback(db, searchInput, filterClauses, { limit });
	}

	// Parsed-path fallback: trigram similarity of a short streetQuery against a
	// long search_text column is often below threshold, even though unit +
	// street_number already narrow the rows tightly. Retry with a direct
	// street_name ILIKE when tiered/ilikeFallback returned nothing.
	if (results.length === 0 && parsed) {
		results = await parsedPathFallback(db, searchInput, filterClauses, {
			limit,
			latitude,
			longitude,
		});
	}

	return { results, parsedQuery: parsed };
}

async function parsedPathFallback(
	db: Database,
	streetQuery: string,
	filterClauses: SQL<unknown>[],
	opts: { limit: number; latitude?: number; longitude?: number }
): Promise<AutocompleteResult[]> {
	const { limit, latitude, longitude } = opts;
	const conditions: SQL<unknown>[] = [...filterClauses];
	if (streetQuery) {
		conditions.push(sql`street_name ILIKE ${`${streetQuery}%`}`);
	}
	const whereClause = sql.join(conditions, sql` AND `);

	const result = await db.execute(sql`
		SELECT ${SELECT_COLUMNS}, 1.0 as similarity_score
		FROM addresses
		WHERE ${whereClause}
		ORDER BY ${buildOrderBy(latitude, longitude)}
		LIMIT ${limit}
	`);

	return (result.rows as unknown as RawAddressRow[]).map(mapRowToResult);
}

async function tieredSearch(
	db: Database,
	trimmed: string,
	len: number,
	filterClauses: SQL<unknown>[],
	opts: { limit: number; latitude?: number; longitude?: number }
): Promise<AutocompleteResult[]> {
	const { limit, latitude, longitude } = opts;
	const orderBy = buildOrderBy(latitude, longitude, "similarity_score");

	// Tier 1 (3-4 chars): Prefix search only (uses B-tree text_pattern_ops index)
	if (len <= PREFIX_SEARCH_MAX_LEN) {
		const prefixPattern = `${trimmed}%`;
		const whereClause = buildWhereClause(
			sql`search_text ILIKE ${prefixPattern}`,
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
		await db.execute(sql`SELECT set_limit(${TRIGRAM_SIMILARITY_THRESHOLD})`);

		const whereClause = buildWhereClause(
			sql`search_text % ${trimmed}::text`,
			filterClauses
		);

		const result = await db.execute(sql`
			SELECT ${SELECT_COLUMNS},
				similarity(search_text, ${trimmed}::text) as similarity_score
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
		sql`search_text <%% ${trimmed}::text`,
		filterClauses
	);

	const result = await db.execute(sql`
		SELECT ${SELECT_COLUMNS},
			word_similarity(search_text, ${trimmed}::text) as similarity_score
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

	const levenshteinRows = levenshteinResult.rows as unknown as RawAddressRow[];

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

/**
 * Fast prefix search that works without any extensions.
 * Uses `search_text ILIKE 'query%'` which can leverage a B-tree index
 * with text_pattern_ops or the default collation.
 */
async function prefixSearch(
	db: Database,
	trimmed: string,
	filterClauses: SQL<unknown>[],
	opts: { limit: number; latitude?: number; longitude?: number }
): Promise<AutocompleteResult[]> {
	const { limit, latitude, longitude } = opts;
	const prefixPattern = `${trimmed}%`;
	const whereClause = buildWhereClause(
		sql`search_text ILIKE ${prefixPattern}`,
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

/**
 * ILIKE fallback when pg_trgm extensions aren't available.
 * Uses prefix matching on the first token (indexable) and filters
 * remaining tokens with substring matching on the narrowed result set.
 */
async function ilikeFallback(
	db: Database,
	trimmed: string,
	filterClauses: SQL<unknown>[],
	opts: { limit: number }
): Promise<AutocompleteResult[]> {
	const { limit } = opts;
	const tokens = trimmed.split(/\s+/).filter(Boolean);

	// First token uses prefix match (can use B-tree index)
	const firstTokenCondition = sql`search_text ILIKE ${`${tokens[0]}%`}`;

	// Additional tokens use substring match but operate on the
	// already-narrowed result set from the first token's index scan
	const additionalConditions = tokens
		.slice(1)
		.map((token) => sql`search_text ILIKE ${`%${token}%`}`);

	const allConditions = [firstTokenCondition, ...additionalConditions];
	const searchCondition =
		allConditions.length > 1
			? sql.join(allConditions, sql` AND `)
			: firstTokenCondition;

	const whereClause = buildWhereClause(searchCondition, filterClauses);

	const result = await db.execute(sql`
		SELECT ${SELECT_COLUMNS}, 1.0 as similarity_score
		FROM addresses
		WHERE ${whereClause}
		LIMIT ${limit}
	`);

	return (result.rows as unknown as RawAddressRow[]).map(mapRowToResult);
}
