import { createAuthClient } from "better-auth/react";

const getAuthBaseUrl = (): string => {
	// The web app proxies all `/api/auth/*` requests to the server via the
	// catch-all route at `routes/api/auth/$.ts`. Point the client at its own
	// origin so the browser never needs to know the real server URL. This
	// avoids build-time `VITE_*` values (localhost) leaking into production.
	if (typeof window !== "undefined") {
		return window.location.origin;
	}

	// SSR: fall back to env so server-side renders can still resolve the URL.
	return (
		import.meta.env.VITE_SERVER_URL ??
		process.env.BETTER_AUTH_URL ??
		"http://localhost:3003"
	);
};

export const authClient = createAuthClient({
	baseURL: getAuthBaseUrl(),
});

export const { useSession, signIn, signUp, signOut } = authClient;
