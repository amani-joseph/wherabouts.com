import { ClerkProvider, useAuth } from "@clerk/tanstack-react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { env } from "@wherabouts.com/env/web";
import { Toaster } from "@wherabouts.com/ui/components/sonner";
import { ConvexProviderWithClerk } from "convex/react-clerk";

import appCss from "../index.css?url";

/** Clerk 404 when JWT template name is not configured in Dashboard */
const CLERK_JWT_TEMPLATE_NOT_FOUND = /not found/i;

const fetchClerkAuth = createServerFn({ method: "GET" }).handler(async () => {
	const clerkAuth = await auth();
	if (!clerkAuth.userId) {
		return { userId: null, token: null };
	}
	let token: string | null = null;
	try {
		token = await clerkAuth.getToken({ template: "convex" });
	} catch (tokenErr) {
		const te = tokenErr as Error;
		// Clerk returns 404 / "Not Found" when JWT template name (e.g. "convex") is missing in Dashboard
		const isMissingJwtTemplate =
			te.name === "ClerkAPIResponseError" &&
			CLERK_JWT_TEMPLATE_NOT_FOUND.test(String(te.message));
		if (isMissingJwtTemplate) {
			token = null;
		} else {
			throw tokenErr;
		}
	}
	return { userId: clerkAuth.userId, token };
});

export interface RouterAppContext {
	convexQueryClient: ConvexQueryClient;
	queryClient: QueryClient;
	token?: string | null;
	userId?: string | null;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
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
	beforeLoad: async (ctx) => {
		const { userId, token } = await fetchClerkAuth();
		if (token) {
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
		}
		return { userId, token };
	},
});

function RootDocument() {
	const context = useRouteContext({ from: Route.id });
	return (
		<ClerkProvider publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}>
			<ConvexProviderWithClerk
				client={context.convexQueryClient.convexClient}
				useAuth={useAuth}
			>
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
			</ConvexProviderWithClerk>
		</ClerkProvider>
	);
}
