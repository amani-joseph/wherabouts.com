import type { Requester } from "../shared-types.ts";

export interface AddressSuggestion {
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

export interface AddressRecord {
	buildingName: string | null;
	confidence: number | null;
	country: string;
	flatNumber: string | null;
	flatType: string | null;
	gnafPid: string | null;
	id: number;
	latitude: number;
	levelNumber: string | null;
	levelType: string | null;
	locality: string;
	longitude: number;
	numberFirst: string | null;
	numberLast: string | null;
	postcode: string;
	state: string;
	streetName: string;
	streetSuffix: string | null;
	streetType: string | null;
}

export interface NearbyAddress {
	buildingName: string | null;
	country: string;
	distance: number;
	flatNumber: string | null;
	flatType: string | null;
	id: number;
	latitude: number;
	locality: string;
	longitude: number;
	numberFirst: string | null;
	numberLast: string | null;
	postcode: string;
	state: string;
	streetName: string;
	streetType: string | null;
}

export interface ReverseGeocodeAddress {
	confidence: number | null;
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

export interface AutocompleteParams {
	country?: string;
	limit?: number;
	q: string;
	state?: string;
}

export interface NearbyParams {
	country?: string;
	lat: number;
	limit?: number;
	lng: number;
	radius?: number;
}

export interface ReverseParams {
	lat: number;
	lng: number;
}

export interface AutocompleteResponse {
	count: number;
	results: AddressSuggestion[];
}

export interface NearbyResponse {
	count: number;
	query: {
		lat: number;
		lng: number;
		radius: number;
	};
	results: NearbyAddress[];
}

export interface ReverseResponse {
	address: ReverseGeocodeAddress;
	distance: number;
	query: {
		lat: number;
		lng: number;
	};
}

export interface AddressesResource {
	autocomplete(params: AutocompleteParams): Promise<AutocompleteResponse>;
	getById(id: number): Promise<AddressRecord>;
	nearby(params: NearbyParams): Promise<NearbyResponse>;
	reverse(params: ReverseParams): Promise<ReverseResponse>;
}

export const createAddresses = (request: Requester): AddressesResource => ({
	autocomplete: (params) =>
		request<AutocompleteResponse>({
			method: "GET",
			path: "/api/v1/addresses/autocomplete",
			query: {
				q: params.q,
				country: params.country,
				state: params.state,
				limit: params.limit,
			},
		}),
	getById: (id) =>
		request<AddressRecord>({
			method: "GET",
			path: `/api/v1/addresses/${id}`,
		}),
	nearby: (params) =>
		request<NearbyResponse>({
			method: "GET",
			path: "/api/v1/addresses/nearby",
			query: {
				lat: params.lat,
				lng: params.lng,
				radius: params.radius,
				limit: params.limit,
				country: params.country,
			},
		}),
	reverse: (params) =>
		request<ReverseResponse>({
			method: "GET",
			path: "/api/v1/addresses/reverse",
			query: { lat: params.lat, lng: params.lng },
		}),
});
