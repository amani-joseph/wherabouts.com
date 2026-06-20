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
