import type { WheraboutsClient } from "@wherabouts/sdk";
import { createWheraboutsClient } from "@wherabouts/sdk";

const DEFAULT_BASE_URL = "https://api.wherabouts.com";

interface DemoEnv {
	VITE_DEMO_API_BASE_URL?: string;
	VITE_DEMO_API_KEY?: string;
}

export function resolveDemoConfig(env: DemoEnv): {
	apiKey: string;
	baseUrl: string;
	configured: boolean;
} {
	const apiKey = env.VITE_DEMO_API_KEY ?? "";
	const baseUrl = env.VITE_DEMO_API_BASE_URL ?? DEFAULT_BASE_URL;
	return { apiKey, baseUrl, configured: apiKey.length > 0 };
}

const config = resolveDemoConfig(import.meta.env as DemoEnv);

export const isDemoConfigured = config.configured;

export function createDemoClient(): WheraboutsClient {
	return createWheraboutsClient({
		apiKey: config.apiKey || "demo-key-not-configured",
		baseUrl: config.baseUrl,
	});
}
