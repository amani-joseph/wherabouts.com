/**
 * Per-country source registry — tier precedence per pipeline spec §9.1.
 * A country is loaded from exactly ONE adapter. Adding a country here is
 * gated on the rollout checklist in spec §9.6 (state mapping, sample
 * eyeball, GeoNames hit-rate, Neon cost check).
 */

export type AdapterName = "overture" | "nad" | "oda";

export interface CountryConfig {
	adapter: AdapterName;
	notes?: string;
	/** How `state` is derived. "none" => state = '' (single-level addressing). */
	state: "none" | "address-level-1";
	/** Region name -> short code (<=10 chars). Required when state = "address-level-1". */
	stateCodes?: Record<string, string>;
}

/** Pinned Overture release. Bump deliberately; record per-country in manifest. */
export const OVERTURE_RELEASE = "2026-05-20.0";

export const COUNTRIES: Record<string, CountryConfig> = {
	IS: {
		adapter: "overture",
		state: "none",
		notes:
			"Single address_level = municipality -> locality. Rural place-name addresses have no number (kept). Validated in smoke test 2026-06-12.",
	},
	// US: { adapter: "nad", ... }   — Tier 1, see spec §9.1
	// CA: { adapter: "oda", ... }   — Tier 1
};

export function getCountryConfig(country: string): CountryConfig {
	const config = COUNTRIES[country.toUpperCase()];
	if (!config) {
		const enabled = Object.keys(COUNTRIES).join(", ");
		throw new Error(
			`Country ${country} is not enabled in the source registry. Enabled: ${enabled}. ` +
				"Complete the rollout checklist (spec §9.6) before adding it."
		);
	}
	return config;
}
