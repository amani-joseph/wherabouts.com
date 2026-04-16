import { WheraboutsApiError } from "./errors.ts";
import type {
	AddressRecord,
	AutocompleteResponse,
	NearbyResponse,
	ReverseResponse,
	WheraboutsApiErrorPayload,
	WheraboutsClient,
	WheraboutsClientConfig,
} from "./types.ts";
import { WHERABOUTS_API_VERSION, WHERABOUTS_SDK_VERSION } from "./types.ts";

const DEFAULT_BASE_URL = "https://api.wherabouts.com";

const appendQueryValue = (
	searchParams: URLSearchParams,
	key: string,
	value: number | string | undefined
) => {
	if (value === undefined) {
		return;
	}

	searchParams.set(key, String(value));
};

const createHeaders = (config: WheraboutsClientConfig): Headers => {
	const headers = new Headers(config.headers);
	headers.set("accept", "application/json");
	headers.set("authorization", `Bearer ${config.apiKey}`);
	headers.set(
		"x-wherabouts-sdk",
		`js-ts/${WHERABOUTS_SDK_VERSION} api/${WHERABOUTS_API_VERSION}`
	);
	return headers;
};

const parseApiError = async (
	response: Response
): Promise<WheraboutsApiError> => {
	let payload: WheraboutsApiErrorPayload | null = null;

	try {
		payload = (await response.json()) as WheraboutsApiErrorPayload;
	} catch {
		payload = null;
	}

	const message =
		payload?.error.message ??
		`Wherabouts request failed with status ${response.status}`;

	return new WheraboutsApiError({
		status: response.status,
		message,
		code: payload?.error.code ?? "unknown_error",
		payload,
	});
};

export const createWheraboutsClient = (
	config: WheraboutsClientConfig
): WheraboutsClient => {
	const fetchImpl = config.fetch ?? globalThis.fetch;
	if (!fetchImpl) {
		throw new Error(
			"A fetch implementation is required to create the SDK client."
		);
	}

	const baseUrl = new URL(config.baseUrl ?? DEFAULT_BASE_URL);
	const headers = createHeaders(config);

	const request = async <T>(
		pathname: string,
		query?: Record<string, number | string | undefined>
	): Promise<T> => {
		const url = new URL(pathname, baseUrl);
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				appendQueryValue(url.searchParams, key, value);
			}
		}

		const response = await fetchImpl(url, {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			throw await parseApiError(response);
		}

		return (await response.json()) as T;
	};

	return {
		autocomplete: async (params) =>
			await request<AutocompleteResponse>("/api/v1/addresses/autocomplete", {
				q: params.q,
				country: params.country,
				state: params.state,
				limit: params.limit,
			}),
		getAddressById: async (id) =>
			await request<AddressRecord>(`/api/v1/addresses/${id}`),
		nearby: async (params) =>
			await request<NearbyResponse>("/api/v1/addresses/nearby", {
				lat: params.lat,
				lng: params.lng,
				radius: params.radius,
				limit: params.limit,
				country: params.country,
			}),
		reverse: async (params) =>
			await request<ReverseResponse>("/api/v1/addresses/reverse", {
				lat: params.lat,
				lng: params.lng,
			}),
	};
};
