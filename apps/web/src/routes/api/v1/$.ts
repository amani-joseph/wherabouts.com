import { createFileRoute } from "@tanstack/react-router";
import { proxyRequestToServer } from "@/lib/auth-server";

export const Route = createFileRoute("/api/v1/$")({
	server: {
		handlers: {
			GET: ({ request }: { request: Request }) => proxyRequestToServer(request),
			OPTIONS: ({ request }: { request: Request }) =>
				proxyRequestToServer(request),
		},
	},
});
