import { WheraboutsApiError } from "./errors.ts";
import {
	type Requester,
	type RequestOptions,
	WHERABOUTS_API_VERSION,
	WHERABOUTS_SDK_VERSION,
	type WheraboutsApiErrorPayload,
	type WheraboutsClientConfig,
} from "./shared-types.ts";

const DEFAULT_BASE_URL = "https://api.wherabouts.com";

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

export const createRequester = (config: WheraboutsClientConfig): Requester => {
	const fetchImpl = config.fetch ?? globalThis.fetch;
	if (!fetchImpl) {
		throw new Error(
			"A fetch implementation is required to create the SDK client."
		);
	}
	const baseUrl = new URL(config.baseUrl ?? DEFAULT_BASE_URL);
	const headers = createHeaders(config);

	return async <T>(opts: RequestOptions): Promise<T> => {
		const url = new URL(opts.path, baseUrl);
		if (opts.query) {
			for (const [key, value] of Object.entries(opts.query)) {
				if (value !== undefined) {
					url.searchParams.set(key, String(value));
				}
			}
		}
		const requestHeaders = new Headers(headers);
		const hasBody = opts.body !== undefined;
		if (hasBody) {
			requestHeaders.set("content-type", "application/json");
		}
		const response = await fetchImpl(url, {
			method: opts.method,
			headers: requestHeaders,
			body: hasBody ? JSON.stringify(opts.body) : undefined,
		});
		if (!response.ok) {
			throw await parseApiError(response);
		}
		if (response.status === 204) {
			return undefined as T;
		}
		const text = await response.text();
		return (text ? JSON.parse(text) : undefined) as T;
	};
};
