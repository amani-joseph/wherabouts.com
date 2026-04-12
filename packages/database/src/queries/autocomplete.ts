import { and, eq, ilike, or, sql } from "drizzle-orm";
import type { Database } from "../client.ts";
import { addresses } from "../schema/addresses.ts";

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

export async function autocompleteAddresses(
	db: Database,
	query: string,
	options: { country?: string; state?: string; limit?: number } = {}
): Promise<AutocompleteResult[]> {
	const { country, state, limit = 10 } = options;
	const trimmed = query.trim();
	if (!trimmed) {
		return [];
	}

	const tokens = trimmed.split(/\s+/).filter(Boolean);
	if (tokens.length === 0) {
		return [];
	}

	// Build conditions: each token must match at least one address field
	const tokenConditions = tokens.map((token) => {
		const pattern = `%${token}%`;
		return or(
			ilike(addresses.streetName, pattern),
			ilike(addresses.locality, pattern),
			ilike(addresses.postcode, pattern),
			ilike(addresses.numberFirst, pattern),
			ilike(addresses.buildingName, pattern),
			ilike(addresses.state, pattern)
		);
	});

	const filters = [];
	if (country) {
		filters.push(eq(addresses.country, country.toUpperCase()));
	}
	if (state) {
		filters.push(eq(addresses.state, state.toUpperCase()));
	}

	const rows = await db
		.select()
		.from(addresses)
		.where(and(...filters, ...tokenConditions))
		.limit(limit);

	return rows.map((row) => {
		const streetAddress = formatStreetAddress(row);
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
	});
}
