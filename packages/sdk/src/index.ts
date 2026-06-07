// biome-ignore lint/performance/noBarrelFile: this is the SDK package's public entry point — a single barrel is the intended module surface.
export { createWheraboutsClient, type WheraboutsClient } from "./client.ts";
export { WheraboutsApiError } from "./errors.ts";
export * from "./resources/addresses.ts";
export * from "./resources/devices.ts";
export * from "./resources/geocode.ts";
export * from "./resources/regions.ts";
export * from "./resources/webhooks.ts";
export * from "./resources/zones.ts";
export {
	WHERABOUTS_API_VERSION,
	WHERABOUTS_SDK_VERSION,
	type WheraboutsApiErrorPayload,
	type WheraboutsClientConfig,
} from "./shared-types.ts";
