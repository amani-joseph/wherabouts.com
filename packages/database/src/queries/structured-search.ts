import { type SQL, sql } from "drizzle-orm";
import type { Database } from "../client.ts";
import { directionalVariants } from "./address-abbreviations.ts";
import {
	type AutocompleteResult,
	mapRowToResult,
	type RawAddressRow,
	SELECT_COLUMNS,
} from "./autocomplete.ts";
import type { ParsedFreeformAddress } from "./parse-freeform-address.ts";

const MAX_ANCHOR_VARIANTS = 4;

/**
 * Build left-anchored `search_text` prefixes (without the trailing %) from a
 * parsed address. Reuses idx_addresses_search_text_btree, which orders rows as
 * "<number> <street_name> ...". Requires a house number (search_text leads with
 * it) and at least one street token; otherwise returns [] and the caller falls
 * back to fuzzy. A leading directional yields both abbreviated + expanded forms.
 */
export function buildAnchorPrefixes(parsed: ParsedFreeformAddress): string[] {
	if (!parsed.houseNumber || parsed.streetTokens.length === 0) {
		return [];
	}
	const firstStreet = parsed.streetTokens[0] as string;
	const heads = parsed.directional
		? directionalVariants(parsed.directional).map(
				(dir) => `${parsed.houseNumber} ${dir} ${firstStreet}`
			)
		: [`${parsed.houseNumber} ${firstStreet}`];
	return heads.slice(0, MAX_ANCHOR_VARIANTS);
}

/**
 * Structured match: OR'd anchored prefix scans (search_text btree), country as a
 * hard filter, postcode/locality/region as ORDER BY boosts. Returns [] when no
 * anchor qualifies so the caller can fall back to fuzzy. See design §4.4.
 */
export async function structuredAutocomplete(
	db: Database,
	parsed: ParsedFreeformAddress,
	opts: { limit: number; country?: string }
): Promise<AutocompleteResult[]> {
	const prefixes = buildAnchorPrefixes(parsed);
	if (prefixes.length === 0) {
		return [];
	}

	const likeClauses = prefixes.map((p) => sql`search_text LIKE ${`${p}%`}`);
	const anchor = sql.join(likeClauses, sql` OR `);

	const filters: SQL<unknown>[] = [sql`(${anchor})`];
	const country = opts.country ?? parsed.countryCode ?? undefined;
	if (country) {
		filters.push(sql`country = ${country.toUpperCase()}`);
	}
	const whereClause = sql.join(filters, sql` AND `);

	const rerank: SQL<unknown>[] = [];
	if (parsed.postcode) {
		rerank.push(sql`(postcode = ${parsed.postcode}) DESC`);
	}
	if (parsed.locality) {
		rerank.push(sql`(locality = ${parsed.locality}) DESC`);
	}
	if (parsed.region) {
		rerank.push(sql`(state = ${parsed.region}) DESC`);
	}
	rerank.push(sql`population_score DESC`);
	const orderBy = sql.join(rerank, sql`, `);

	const result = await db.execute(sql`
		SELECT ${SELECT_COLUMNS}, 1.0 as similarity_score
		FROM addresses
		WHERE ${whereClause}
		ORDER BY ${orderBy}
		LIMIT ${opts.limit}
	`);

	return (result.rows as unknown as RawAddressRow[]).map(mapRowToResult);
}
