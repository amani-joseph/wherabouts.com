import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/get-session")({
	server: {
		handlers: {
			GET: () => Response.json({ test: true, msg: "get-session route works" }),
		},
	},
});
