export const WHERABOUTS_API_VERSION = "v1" as const;
export const WHERABOUTS_SDK_VERSION = "0.1.0-preview" as const;

export interface WheraboutsApiErrorPayload {
	error: {
		code: "bad_request" | "internal_error" | "not_found" | "unauthorized";
		message: string;
	};
}

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

export interface WheraboutsClientConfig {
	apiKey: string;
	baseUrl?: string;
	fetch?: typeof fetch;
	headers?: Record<string, string>;
}

export interface WheraboutsClient {
	autocomplete(params: AutocompleteParams): Promise<AutocompleteResponse>;
	getAddressById(id: number): Promise<AddressRecord>;
	nearby(params: NearbyParams): Promise<NearbyResponse>;
	reverse(params: ReverseParams): Promise<ReverseResponse>;
}

// --- Zones ---

export interface ZoneRecord {
	createdAt: string;
	description: string | null;
	id: number;
	metadata: Record<string, unknown> | null;
	name: string;
	projectId: string;
	updatedAt: string;
}

export interface ZoneWithGeometry extends ZoneRecord {
	geometry: {
		type: string;
		coordinates: number[][][];
	};
}

export interface ZoneContainsResponse {
	count: number;
	query: { lat: number; lng: number };
	zones: ZoneRecord[];
}

export interface ZoneAddressesResponse {
	count: number;
	query: { id: number; page: number; limit: number };
	results: Array<{
		id: number;
		country: string;
		state: string;
		locality: string;
		postcode: string;
		streetName: string;
		streetType: string | null;
		numberFirst: string | null;
		numberLast: string | null;
		buildingName: string | null;
		flatType: string | null;
		flatNumber: string | null;
		latitude: number;
		longitude: number;
	}>;
	truncated: boolean;
}

// --- Forward Geocoding ---

export interface ForwardGeocodeResponse {
	address: {
		id: number;
		formattedAddress: string;
		streetAddress: string;
		locality: string;
		state: string;
		postcode: string;
		country: string;
		latitude: number;
		longitude: number;
	};
	matchType: "structured" | "fuzzy";
}

// --- Batch Geocoding ---

export interface BatchGeocodeSubmitResponse {
	inputCount: number;
	jobId: string;
	status: "pending" | "processing";
}

export interface BatchGeocodePollResponse {
	completedAt: string | null;
	downloadUrl: string | null;
	error: string | null;
	inputCount: number;
	jobId: string;
	processedCount: number;
	status: "pending" | "processing" | "completed" | "failed";
}

export interface BatchGeocodeResultsResponse {
	count: number;
	results: unknown[];
}

// --- Devices ---

export interface DeviceLocationResponse {
	crossings: Array<{
		zoneId: number;
		zoneName: string;
		event: "entry" | "exit";
	}>;
	zones: number[];
}

export interface DeviceZonesResponse {
	deviceId: string;
	latitude: number;
	longitude: number;
	updatedAt: Date | string;
	zoneIds: number[];
}

// --- Webhooks ---

export interface WebhookSubscriptionRecord {
	active: boolean;
	createdAt: string;
	events: string[];
	failing: boolean;
	id: number;
	url: string;
	zoneId: number | null;
}

// --- Webhooks (dashboard) ---

export interface WebhookDeliveryAttemptRecord {
	attempt: number;
	createdAt: string;
	deviceId: string | null;
	error: string | null;
	event: string;
	id: number;
	ok: boolean;
	statusCode: number | null;
	zoneId: number | null;
}

export interface WebhookReactivateResponse {
	success: boolean;
}

export interface WebhookCreateResponse {
	active: boolean;
	createdAt: string;
	events: string[];
	id: number;
	secret: string; // Returned ONCE at creation time only
	url: string;
	zoneId: number | null;
}
