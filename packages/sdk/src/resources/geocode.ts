import type { Requester } from "../shared-types.ts";

// ---------------------------------------------------------------------------
// Forward geocode types
// ---------------------------------------------------------------------------

/**
 * Params for forward geocoding. Provide `q` for unstructured free-text search,
 * OR `street` + `locality` (plus optional `state`, `postcode`, `country`) for
 * structured mode. Set `structured: "true"` when using structured fields.
 */
export interface ForwardGeocodeParams {
	/** ISO 3166-1 alpha-2 country code, e.g. "AU". */
	country?: string;
	/** Suburb / locality (structured mode). */
	locality?: string;
	/** Postcode / ZIP. */
	postcode?: string;
	/** Free-text address query (unstructured mode). */
	q?: string;
	/** State abbreviation, e.g. "NSW". */
	state?: string;
	/** Street address (structured mode). */
	street?: string;
	/** Pass `"true"` to enable structured mode. */
	structured?: "true" | "false";
}

export interface GeocodeAddress {
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

export interface ForwardGeocodeResponse {
	address: GeocodeAddress;
	matchType: "structured" | "fuzzy";
}

// ---------------------------------------------------------------------------
// Batch geocode types
// ---------------------------------------------------------------------------

export interface BatchSubmitBody {
	addresses: string[];
}

export interface BatchSubmitResponse {
	inputCount: number;
	jobId: string;
	status: "pending" | "processing";
}

export interface BatchJobStatus {
	completedAt: string | null;
	downloadUrl: string | null;
	error: string | null;
	inputCount: number;
	jobId: string;
	processedCount: number | null;
	status: "pending" | "processing" | "completed" | "failed";
}

export interface BatchResultsResponse {
	count: number;
	results: unknown[];
}

// ---------------------------------------------------------------------------
// Resource factory
// ---------------------------------------------------------------------------

export interface GeocodeResource {
	batch: {
		submit(body: BatchSubmitBody): Promise<BatchSubmitResponse>;
		poll(jobId: string): Promise<BatchJobStatus>;
		results(jobId: string): Promise<BatchResultsResponse>;
	};
	forward(params: ForwardGeocodeParams): Promise<ForwardGeocodeResponse>;
}

export const createGeocode = (request: Requester): GeocodeResource => ({
	forward: (params) =>
		request<ForwardGeocodeResponse>({
			method: "GET",
			path: "/api/v1/addresses/geocode",
			query: {
				q: params.q,
				structured: params.structured,
				street: params.street,
				locality: params.locality,
				state: params.state,
				postcode: params.postcode,
				country: params.country,
			},
		}),
	batch: {
		submit: (body) =>
			request<BatchSubmitResponse>({
				method: "POST",
				path: "/api/v1/geocode/batch",
				body,
			}),
		poll: (jobId) =>
			request<BatchJobStatus>({
				method: "GET",
				path: `/api/v1/geocode/batch/${jobId}`,
			}),
		results: (jobId) =>
			request<BatchResultsResponse>({
				method: "GET",
				path: `/api/v1/geocode/batch/${jobId}/results`,
			}),
	},
});
