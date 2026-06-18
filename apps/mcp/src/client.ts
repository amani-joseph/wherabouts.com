import { createWheraboutsClient, type WheraboutsClient } from "@wherabouts/sdk";

export const buildClient = (
	apiKey: string,
	baseUrl: string,
	fetchImpl: typeof fetch = fetch
): WheraboutsClient =>
	createWheraboutsClient({ apiKey, baseUrl, fetch: fetchImpl });
