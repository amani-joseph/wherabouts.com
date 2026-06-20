export type Capability = "geocode" | "reverse" | "autocomplete";

export interface CoverageCountry {
	capabilities: Capability[];
	iso2: string;
	name: string;
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
	geocode: "Geocode",
	reverse: "Reverse",
	autocomplete: "Autocomplete",
};

const ALL_CAPABILITIES: Capability[] = ["geocode", "reverse", "autocomplete"];

// Source of truth: the 17 ISO-2 codes resolved by matchCountry() in
// packages/database/src/queries/country-codes.ts. A country absent from that
// matcher cannot be filtered by country, so it is not "covered". All loaded
// countries share the same addresses table and query paths, hence the uniform
// capability set; the per-country array allows divergence later.
export const COVERAGE_COUNTRIES: CoverageCountry[] = [
	{ iso2: "AU", name: "Australia", capabilities: ALL_CAPABILITIES },
	{ iso2: "AT", name: "Austria", capabilities: ALL_CAPABILITIES },
	{ iso2: "BE", name: "Belgium", capabilities: ALL_CAPABILITIES },
	{ iso2: "CA", name: "Canada", capabilities: ALL_CAPABILITIES },
	{ iso2: "DK", name: "Denmark", capabilities: ALL_CAPABILITIES },
	{ iso2: "FI", name: "Finland", capabilities: ALL_CAPABILITIES },
	{ iso2: "FR", name: "France", capabilities: ALL_CAPABILITIES },
	{ iso2: "DE", name: "Germany", capabilities: ALL_CAPABILITIES },
	{ iso2: "IT", name: "Italy", capabilities: ALL_CAPABILITIES },
	{ iso2: "NL", name: "Netherlands", capabilities: ALL_CAPABILITIES },
	{ iso2: "NO", name: "Norway", capabilities: ALL_CAPABILITIES },
	{ iso2: "PL", name: "Poland", capabilities: ALL_CAPABILITIES },
	{ iso2: "PT", name: "Portugal", capabilities: ALL_CAPABILITIES },
	{ iso2: "ES", name: "Spain", capabilities: ALL_CAPABILITIES },
	{ iso2: "CH", name: "Switzerland", capabilities: ALL_CAPABILITIES },
	{ iso2: "GB", name: "United Kingdom", capabilities: ALL_CAPABILITIES },
	{ iso2: "US", name: "United States", capabilities: ALL_CAPABILITIES },
];

const REGIONAL_INDICATOR_BASE = 0x1_f1_e6;
const UPPERCASE_A = 65;

// "US" -> "🇺🇸". Maps each ASCII letter to its regional-indicator code point.
export function iso2ToFlag(iso2: string): string {
	return [...iso2.toUpperCase()]
		.map((char) =>
			String.fromCodePoint(
				REGIONAL_INDICATOR_BASE + (char.charCodeAt(0) - UPPERCASE_A)
			)
		)
		.join("");
}

export function filterCountries(
	query: string,
	list: CoverageCountry[]
): CoverageCountry[] {
	const normalized = query.trim().toLowerCase();
	if (normalized === "") {
		return list;
	}
	return list.filter(
		(country) =>
			country.name.toLowerCase().includes(normalized) ||
			country.iso2.toLowerCase().includes(normalized)
	);
}
