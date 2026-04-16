import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/ok")({
	server: {
		handlers: {
			GET: () => Response.json({ ok: true, source: "web-proxy" }),
		},
	},
});
