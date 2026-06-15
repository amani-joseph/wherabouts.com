import { WheraboutsApiError } from "./errors.ts";
import {
	type HttpMethod,
	type Requester,
	type RequestLogEvent,
	type RequestOptions,
	WHERABOUTS_API_VERSION,
	WHERABOUTS_SDK_VERSION,
	type WheraboutsApiErrorPayload,
	type WheraboutsClientConfig,
} from "./shared-types.ts";

const DEFAULT_BASE_URL = "https://api.wherabouts.com";
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 30_000;
const BACKOFF_BASE_MS = 200;
const BACKOFF_CAP_MS = 5000;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const WRITE_METHODS = new Set<HttpMethod>(["POST", "PUT"]);

const createBaseHeaders = (config: WheraboutsClientConfig): Headers => {
	const headers = new Headers(config.headers);
	headers.set("accept", "application/json");
	headers.set("authorization", `Bearer ${config.apiKey}`);
	headers.set(
		"x-wherabouts-sdk",
		`js-ts/${WHERABOUTS_SDK_VERSION} api/${WHERABOUTS_API_VERSION}`
	);
	return headers;
};

const generateIdempotencyKey = (): string => {
	const cryptoObj = globalThis.crypto;
	if (cryptoObj?.randomUUID) {
		return cryptoObj.randomUUID();
	}
	// Fallback for runtimes without crypto.randomUUID.
	return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
};

const buildRequestHeaders = (
	baseHeaders: Headers,
	opts: RequestOptions
): Headers => {
	const headers = new Headers(baseHeaders);
	if (opts.headers) {
		for (const [key, value] of Object.entries(opts.headers)) {
			headers.set(key, value);
		}
	}
	if (opts.body !== undefined) {
		headers.set("content-type", "application/json");
	}
	// Writes carry an Idempotency-Key so retries are safe (docs/CONTRACT.md §6).
	if (WRITE_METHODS.has(opts.method)) {
		headers.set(
			"idempotency-key",
			opts.idempotencyKey ?? generateIdempotencyKey()
		);
	} else if (opts.idempotencyKey) {
		headers.set("idempotency-key", opts.idempotencyKey);
	}
	return headers;
};

const readRequestId = (response: Response): string | null =>
	response.headers.get("x-request-id") ??
	response.headers.get("x-wherabouts-request-id");

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
		requestId: payload?.error.request_id ?? readRequestId(response),
		docUrl: payload?.error.doc_url ?? null,
		fields: payload?.error.fields ?? null,
	});
};

/** Parse a `Retry-After` header (delta-seconds or HTTP-date) to milliseconds. */
const parseRetryAfter = (value: string | null): number | null => {
	if (!value) {
		return null;
	}
	const seconds = Number(value);
	if (Number.isFinite(seconds)) {
		return Math.max(0, seconds * 1000);
	}
	const dateMs = Date.parse(value);
	if (Number.isNaN(dateMs)) {
		return null;
	}
	return Math.max(0, dateMs - Date.now());
};

/** Exponential backoff with full jitter, capped. */
const computeBackoff = (attempt: number): number => {
	const exponential = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
	return Math.random() * exponential;
};

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
	new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason ?? new Error("Aborted"));
			return;
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(signal?.reason ?? new Error("Aborted"));
		};
		signal?.addEventListener("abort", onAbort, { once: true });
	});

export const createRequester = (config: WheraboutsClientConfig): Requester => {
	const fetchImpl = config.fetch ?? globalThis.fetch;
	if (!fetchImpl) {
		throw new Error(
			"A fetch implementation is required to create the SDK client."
		);
	}
	const baseUrl = new URL(config.baseUrl ?? DEFAULT_BASE_URL);
	const baseHeaders = createBaseHeaders(config);

	return async <T>(opts: RequestOptions): Promise<T> => {
		const url = new URL(opts.path, baseUrl);
		if (opts.query) {
			for (const [key, value] of Object.entries(opts.query)) {
				if (value !== undefined) {
					url.searchParams.set(key, String(value));
				}
			}
		}

		const headers = buildRequestHeaders(baseHeaders, opts);
		const hasBody = opts.body !== undefined;
		const body = hasBody ? JSON.stringify(opts.body) : undefined;
		const maxRetries =
			opts.maxRetries ?? config.maxRetries ?? DEFAULT_MAX_RETRIES;
		const timeoutMs = opts.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		// GET/PUT/DELETE are idempotent; POST is only retry-safe with a key (always
		// set for writes above), so every request here is retryable by method.
		const callerSignal = opts.signal;
		const startTime = Date.now();

		let attempt = 0;
		// Retry loop: returns on success or non-retryable failure; otherwise waits
		// and continues until `maxRetries` is exhausted.
		while (true) {
			const controller = new AbortController();
			let timedOut = false;
			const timeoutId = setTimeout(() => {
				timedOut = true;
				controller.abort();
			}, timeoutMs);
			const onCallerAbort = () => controller.abort();
			if (callerSignal) {
				if (callerSignal.aborted) {
					controller.abort();
				} else {
					callerSignal.addEventListener("abort", onCallerAbort, { once: true });
				}
			}

			try {
				const response = await fetchImpl(url, {
					method: opts.method,
					headers,
					body,
					signal: controller.signal,
				});

				const durationMs = Date.now() - startTime;
				config.logger?.({
					method: opts.method,
					path: opts.path,
					status: response.status,
					durationMs,
					requestId: readRequestId(response) ?? undefined,
				});

				if (!response.ok) {
					if (RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
						const wait =
							parseRetryAfter(response.headers.get("retry-after")) ??
							computeBackoff(attempt);
						attempt++;
						await sleep(Math.min(wait, BACKOFF_CAP_MS), callerSignal);
						continue;
					}
					throw await parseApiError(response);
				}

				if (response.status === 204) {
					return undefined as T;
				}
				const text = await response.text();
				return (text ? JSON.parse(text) : undefined) as T;
			} catch (error) {
				// Caller aborted — never retry; propagate their intent.
				if (callerSignal?.aborted) {
					throw error;
				}
				// Our timeout fired — treat like a transient failure.
				if (timedOut) {
					if (attempt < maxRetries) {
						attempt++;
						await sleep(computeBackoff(attempt - 1), callerSignal);
						continue;
					}
					throw new WheraboutsApiError({
						status: 0,
						code: "timeout",
						message: `Request timed out after ${timeoutMs}ms.`,
					});
				}
				// A parsed API error (non-retryable status) — surface as-is.
				if (error instanceof WheraboutsApiError) {
					throw error;
				}
				// Network/transport error — retry if budget remains.
				if (attempt < maxRetries) {
					attempt++;
					await sleep(computeBackoff(attempt - 1), callerSignal);
					continue;
				}
				throw error;
			} finally {
				clearTimeout(timeoutId);
				callerSignal?.removeEventListener("abort", onCallerAbort);
			}
		}
	};
};
