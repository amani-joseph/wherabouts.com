import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { Toaster } from "@wherabouts.com/ui/components/sonner";
import { authClient } from "@/lib/auth-client";
import { type BetterAuthSession, getSession } from "@/lib/auth-server";

import appCss from "../index.css?url";

const fetchSession = createServerFn({ method: "GET" }).handler(async () => {
	return await getSession();
});

export interface RouterAppContext {
	isAuthenticated?: boolean;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content:
					"width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
			},
			{
				title: "Wherabouts — Locations API for developers",
			},
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/brand/favicon.svg",
			},
			{
				rel: "apple-touch-icon",
				href: "/brand/favicon.svg",
			},
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	component: RootDocument,
	beforeLoad: async () => {
		// Server-side (SSR): forward incoming request headers to the auth server.
		if (typeof window === "undefined") {
			let session: BetterAuthSession | null = null;
			try {
				session = await fetchSession();
			} catch {
				// fetchSession may throw when request context is unavailable.
			}
			return { isAuthenticated: Boolean(session?.session) };
		}

		// Client-side (SPA navigation): check the session directly with the
		// auth server. The browser includes the cross-origin auth cookie
		// (SameSite=None) which the server function route cannot forward.
		try {
			const { data } = await authClient.getSession();
			return { isAuthenticated: Boolean(data?.session) };
		} catch {
			return { isAuthenticated: false };
		}
	},
});

function RootDocument() {
	return (
		<html className="dark" lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<div className="grid h-svh grid-rows-[auto_1fr]">
					<Outlet />
				</div>
				<Toaster richColors />
				<TanStackRouterDevtools position="bottom-left" />
				<Scripts />
			</body>
		</html>
	);
}
