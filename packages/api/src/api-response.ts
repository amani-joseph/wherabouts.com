export type ApiErrorCode =
	| "bad_request"
	| "internal_error"
	| "not_found"
	| "unauthorized";

export interface ApiErrorResponseBody {
	error: {
		code: ApiErrorCode;
		message: string;
	};
}

export const createApiErrorBody = (
	code: ApiErrorCode,
	message: string
): ApiErrorResponseBody => ({
	error: {
		code,
		message,
	},
});

export const jsonApiError = (
	status: number,
	code: ApiErrorCode,
	message: string
): Response =>
	Response.json(createApiErrorBody(code, message), {
		status,
		headers: {
			"cache-control": "no-store",
		},
	});

export const applyServerTiming = (
	response: Response,
	durationMs: number,
	metric = "app"
): Response => {
	const safeMetric = metric.replace(/[^a-zA-Z0-9_-]/g, "_");
	response.headers.set(
		"Server-Timing",
		`${safeMetric};dur=${durationMs.toFixed(1)}`
	);
	return response;
};
