import type { WheraboutsApiErrorPayload } from "./types.ts";

export class WheraboutsApiError extends Error {
	readonly code: WheraboutsApiErrorPayload["error"]["code"] | "unknown_error";
	readonly payload: WheraboutsApiErrorPayload | null;
	readonly status: number;

	public constructor(options: {
		code?: WheraboutsApiError["code"];
		message: string;
		payload?: WheraboutsApiErrorPayload | null;
		status: number;
	}) {
		super(options.message);
		this.name = "WheraboutsApiError";
		this.status = options.status;
		this.code = options.code ?? "unknown_error";
		this.payload = options.payload ?? null;
	}
}
