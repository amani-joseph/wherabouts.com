import type { AddressSuggestion } from "@wherabouts/sdk";

export interface AddressWithParsed {
	id: number;
	formattedAddress: string;
	latitude: number;
	longitude: number;
	streetAddress: string;
	suburb: string;
	state: string;
	postcode: string;
	country: string;
}

export interface AddressI18nStrings {
	noResults: string;
	enterManually: string;
	errorRetry: string;
	geolocationError: string;
}

export type AddressValidateFn =
	(address: AddressWithParsed) => Promise<{ message: string } | null>;

export type AddressSuggestionInput = AddressSuggestion;
