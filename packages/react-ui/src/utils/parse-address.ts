import type { AddressSuggestion } from "@wherabouts/sdk";
import type { AddressWithParsed } from "../types";

// Resolve ISO 3166-1 country codes to display names via the platform Intl data —
// full international coverage with zero maintenance. Falls back to the raw code
// when Intl.DisplayNames is unavailable or the code is unrecognized.
const REGION_DISPLAY_NAMES =
	typeof Intl !== "undefined" && "DisplayNames" in Intl
		? new Intl.DisplayNames(["en"], { type: "region" })
		: null;

function countryName(code: string): string {
	if (!code) {
		return code;
	}
	try {
		return REGION_DISPLAY_NAMES?.of(code.toUpperCase()) ?? code;
	} catch {
		// of() throws RangeError on malformed codes — keep the raw value.
		return code;
	}
}

/**
 * Light client-side cleanup before sending to the API for snappier typeahead.
 * The server is authoritative (parseFreeformAddress); this only normalizes
 * obvious whitespace/comma noise so keystrokes look clean. Does NOT strip the
 * country or parse components.
 */
export function cleanAddressInput(input: string): string {
	return input
		.replace(/\s*,\s*/g, ", ")
		.replace(/\s+/g, " ")
		.trim();
}

export function toAddressWithParsed(
	suggestion: AddressSuggestion
): AddressWithParsed {
	return {
		id: suggestion.id,
		formattedAddress: suggestion.formattedAddress,
		latitude: suggestion.latitude,
		longitude: suggestion.longitude,
		streetAddress: suggestion.streetAddress,
		suburb: suggestion.locality,
		state: suggestion.state,
		postcode: suggestion.postcode,
		country: countryName(suggestion.country),
	};
}
