import { convexClient } from "@convex-dev/better-auth/client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [convexClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
