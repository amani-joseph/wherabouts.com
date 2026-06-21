/**
 * Log a diagnostic in development only. Mirrors the react-ui dev-log helper so
 * the Vue components stay quiet in production builds while surfacing SDK/network
 * failures during local development.
 */
export function logDevError(message: string, error: unknown): void {
	if (
		typeof process !== "undefined" &&
		process.env?.NODE_ENV === "production"
	) {
		return;
	}
	// biome-ignore lint/suspicious/noConsole: dev-only diagnostic
	console.error(`[wherabouts/vue-ui] ${message}`, error);
}
