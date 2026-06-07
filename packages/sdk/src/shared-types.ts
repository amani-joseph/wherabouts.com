export const WHERABOUTS_API_VERSION = "v1" as const;
export const WHERABOUTS_SDK_VERSION = "0.2.0-preview" as const;

export interface WheraboutsApiErrorPayload {
	error: {
		code: "bad_request" | "internal_error" | "not_found" | "unauthorized";
		message: string;
	};
}

export interface WheraboutsClientConfig {
	apiKey: string;
	baseUrl?: string;
	fetch?: typeof fetch;
	headers?: Record<string, string>;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface RequestOptions {
	body?: unknown;
	method: HttpMethod;
	path: string;
	query?: Record<string, number | string | undefined>;
}

export type Requester = <T>(opts: RequestOptions) => Promise<T>;
