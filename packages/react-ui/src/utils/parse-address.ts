import type { AddressSuggestion } from "@wherabouts/sdk";
import type { AddressWithParsed } from "../types";

const COUNTRY_NAMES: Record<string, string> = {
	AU: "Australia",
};

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
		country: COUNTRY_NAMES[suggestion.country] ?? suggestion.country,
	};
}
