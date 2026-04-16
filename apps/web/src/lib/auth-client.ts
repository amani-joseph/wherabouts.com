import { createAuthClient } from "better-auth/react";

const getAuthBaseUrl = (): string => {
	// Local dev: point at the local server.
	if (
		typeof window !== "undefined" &&
		window.location.hostname === "localhost"
	) {
		return "http://localhost:3003";
	}

	// Production: point directly at the server Worker. TanStack Start on CF
	// Workers cannot dispatch POST server handlers, so same-origin proxying
	// is not viable. Cross-origin cookies work via SameSite=None on the server.
	return (
		import.meta.env.VITE_SERVER_URL ??
		process.env.BETTER_AUTH_URL ??
		"http://localhost:3003"
	);
};

export const authClient = createAuthClient({
	baseURL: getAuthBaseUrl(),
	fetchOptions: {
		credentials: "include",
	},
});

export const { useSession, signIn, signUp, signOut } = authClient;
