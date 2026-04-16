import { createFileRoute } from "@tanstack/react-router";
import { handler } from "@/lib/auth-server";

export const Route = createFileRoute("/api/auth/sign-up/email")({
	server: {
		handlers: {
			POST: ({ request }: { request: Request }) => handler(request),
		},
	},
});
