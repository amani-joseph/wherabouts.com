import { createAuthClient } from "better-auth/react";

const getAuthBaseUrl = (): string => {
	// Local dev: point at the local server.
	if (
		typeof window !== "undefined" &&
		window.location.hostname === "localhost"
	) {
		return "http://localhost:3003";
	}

	// Production: point at the API server. Cross-subdomain cookies on
	// .wherabouts.com share session between web and API.
	return (
		import.meta.env.VITE_SERVER_URL ??
		process.env.BETTER_AUTH_URL ??
		"https://api.wherabouts.com"
	);
};

export const authClient = createAuthClient({
	baseURL: getAuthBaseUrl(),
	fetchOptions: {
		credentials: "include",
	},
});

export const { useSession, signIn, signUp, signOut } = authClient;
