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
	LU: {
		adapter: "overture",
		state: "none",
		notes:
			"Single address_level = commune (max 30 chars) -> locality. 0 null postcodes/streets in probe. Prod canary 2026-06-12.",
	},
	// --- Europe campaign 2026-06-12: probe results in /tmp/probe-europe.csv ---
	// (single full-scan probe of Overture 2026-05-20.0; "nullpc/nullst" = % null
	// postcode/street in source — caveats, not blockers; skip-rule handles them)
	AT: {
		adapter: "overture",
		state: "none",
		notes: "2 lvls but lvl1=municipality (long names).",
	},
	BE: { adapter: "overture", state: "none", notes: "1 lvl = commune." },
	CH: { adapter: "overture", state: "none", notes: "1 lvl = commune." },
	CZ: {
		adapter: "overture",
		state: "none",
		notes: "1 lvl. nullst 47.8% (rural number-only addressing).",
	},
	DE: {
		adapter: "overture",
		state: "address-level-1",
		notes:
			"2 lvls, lvl1 = 2-char Land code (NW, SL…). nullpc 79.3% — postcode search weak until backfill.",
	},
	DK: {
		adapter: "overture",
		state: "none",
		notes: "2 lvls but lvl1=long region name.",
	},
	EE: {
		adapter: "overture",
		state: "none",
		notes: "3 lvls, last=settlement. nullpc 100%, nullst 41.9%.",
	},
	ES: { adapter: "overture", state: "none", notes: "1 lvl = municipality." },
	FI: {
		adapter: "overture",
		state: "none",
		notes: "1 lvl = municipality (uppercase source).",
	},
	FO: {
		adapter: "overture",
		state: "none",
		notes: "2 lvls, lvl1 up to 12 chars -> none.",
	},
	FR: {
		adapter: "overture",
		state: "none",
		notes:
			"1 lvl = commune. Includes overseas territories (BAN-sourced) — kept per decision 2026-06-12.",
	},
	HR: {
		adapter: "overture",
		state: "none",
		notes: "1 lvl = settlement (long names).",
	},
	IT: {
		adapter: "overture",
		state: "none",
		notes: "3 lvls (region/province/comune), last=comune. nullpc 100%.",
	},
	LI: { adapter: "overture", state: "none", notes: "1 lvl = commune." },
	LT: { adapter: "overture", state: "none", notes: "1 lvl. nullst 6.5%." },
	LV: {
		adapter: "overture",
		state: "none",
		notes: "3 lvls, last=village/town. nullst 41.4%.",
	},
	NL: {
		adapter: "overture",
		state: "none",
		notes: "1 lvl = place. nullpc 2.5%.",
	},
	NO: {
		adapter: "overture",
		state: "none",
		notes: "1 lvl = municipality (uppercase source).",
	},
	PL: {
		adapter: "overture",
		state: "none",
		notes: "3 lvls (powiat/gmina/town), last=town. nullst 35.9%.",
	},
	PT: {
		adapter: "overture",
		state: "none",
		notes: "1 lvl. null number 22.2% (street-level points kept).",
	},
	RS: { adapter: "overture", state: "none", notes: "1 lvl. nullpc 100%." },
	SI: { adapter: "overture", state: "none", notes: "3 lvls, last=settlement." },
	SK: {
		adapter: "overture",
		state: "none",
		notes: "3 lvls, last=municipality. nullst 55.5%.",
	},
	CA: {
		adapter: "oda",
		state: "none", // state derived from PRUID inside the ODA adapter, not address_levels
		notes:
			"Tier-1 StatCan ODA (~10M rows, OGL-Canada). _pcs standardized fields used. " +
			"GAP: ODA v1 has no NL/YT/NU — consider Overture backfill for those provinces later. " +
			"Postcode coverage varies by provider (PE 100% null).",
	},
	US: {
		adapter: "overture",
		state: "address-level-1", // address_levels[1] = 2-letter state code (CA, TX…)
		notes:
			"126.5M rows — loaded state-by-state via us-queue.ts (--state) for resumability. " +
			"Chose Overture over NAD Tier-1 2026-06-14 (proven path, NAD-derived + OpenAddresses). " +
			"Coverage varies by state (NV/SC/GA sparse in Overture). NAD upgrade possible later via --replace.",
	},
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
