import { createFileRoute } from "@tanstack/react-router";
import { proxyRequestToServer } from "@/lib/auth-server";

export const Route = createFileRoute("/rpc/$")({
	server: {
		handlers: {
			GET: ({ request }: { request: Request }) => proxyRequestToServer(request),
			POST: ({ request }: { request: Request }) =>
				proxyRequestToServer(request),
			OPTIONS: ({ request }: { request: Request }) =>
				proxyRequestToServer(request),
		},
	},
});
